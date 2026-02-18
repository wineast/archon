/**
 * Pricing Engine — dynamic function stored in DB.
 *
 * Base dep: compileExpression (filtrex) — always injected.
 * Returns `pricingEngine(config, args)` — the public API.
 */
function fn(compileExpression) {
  // ── Constants ──

  var ENGINE_DEFAULTS = { lockDays: 30, extensionDays: 0 };

  var FILTREX_KEYWORDS = new Set([
    "and", "or", "not", "in", "if", "then", "else",
    "true", "false", "null", "undefined",
  ]);

  // ── Field extraction ──

  function extractFieldsFromExpression(when) {
    var withoutStrings = when.replace(/"[^"]*"|'[^']*'/g, '""');
    var identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    var matches = withoutStrings.match(identifierRegex) || [];
    var seen = new Set();
    var fields = [];
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      if (!FILTREX_KEYWORDS.has(m.toLowerCase()) && !seen.has(m)) {
        seen.add(m);
        fields.push(m);
      }
    }
    return fields;
  }

  function shouldSkipAdjustment(when, fieldValues) {
    var fields = extractFieldsFromExpression(when);
    var provided = new Set(Object.keys(fieldValues));
    var missing = fields.filter(function (f) { return !provided.has(f); });
    return { skip: missing.length > 0, missingFields: missing };
  }

  // ── Expression evaluation ──

  function evaluateExpression(when, fieldValues) {
    try {
      var filter = compileExpression(when);
      var result = filter(fieldValues);
      return Boolean(result);
    } catch (e) {
      return false;
    }
  }

  // ── LLPA matrix lookup ──

  function lookupLLPAMatrices(matrices, fieldValues) {
    var triggered = [];

    for (var i = 0; i < matrices.length; i++) {
      var matrix = matrices[i];

      if (!evaluateExpression(matrix.when, fieldValues)) continue;

      var fico = fieldValues.ficoScore;
      var ltv = fieldValues.ltv;
      if (fico === undefined || ltv === undefined) continue;

      var ficoIdx = -1;
      for (var fi = 0; fi < matrix.ficoRanges.length; fi++) {
        var r = matrix.ficoRanges[fi];
        if (fico >= r.min && fico <= r.max) { ficoIdx = fi; break; }
      }

      var ltvIdx = -1;
      for (var li = 0; li < matrix.ltvRanges.length; li++) {
        var r2 = matrix.ltvRanges[li];
        if (ltv >= r2.min && ltv <= r2.max) { ltvIdx = li; break; }
      }

      if (ficoIdx === -1 || ltvIdx === -1) continue;

      var value = matrix.values[ficoIdx] && matrix.values[ficoIdx][ltvIdx];
      if (value === null || value === undefined || value === 0) continue;

      var ficoLabel = matrix.ficoRanges[ficoIdx].label;
      var ltvLabel = matrix.ltvRanges[ltvIdx].label;

      var adj = {
        name: matrix.name + ": FICO " + ficoLabel + ", LTV " + ltvLabel,
        citations: [matrix.citation],
      };

      if (matrix.adjustmentType === "fee" || matrix.adjustmentType === "price") {
        adj.priceAdj = -value;
      } else {
        adj.rateAdj = value;
      }

      triggered.push(adj);
    }

    return triggered;
  }

  // ── Adjustment evaluation ──

  function evaluateAdjustments(adjustments, fieldValues, category) {
    var triggered = [];
    var skipped = [];

    for (var i = 0; i < adjustments.length; i++) {
      var adj = adjustments[i];

      if (adj.appliesTo && adj.appliesTo.length > 0 && adj.appliesTo.indexOf(category) === -1) {
        continue;
      }

      var result = shouldSkipAdjustment(adj.when, fieldValues);
      if (result.skip) {
        skipped.push({
          name: adj.name,
          reason: "missing_field",
          missingFields: result.missingFields,
          expression: adj.when,
          priceAdj: adj.priceAdj,
          rateAdj: adj.rateAdj,
        });
        continue;
      }

      if (evaluateExpression(adj.when, fieldValues)) {
        triggered.push({
          name: adj.name,
          expression: adj.when,
          priceAdj: adj.priceAdj,
          rateAdj: adj.rateAdj,
          citations: adj.citations,
        });
      }
    }

    return { triggered: triggered, skipped: skipped };
  }

  // ── Stacking rules ──

  function applyStackingRules(triggered, stackingRules) {
    var result = triggered.slice();

    for (var i = 0; i < stackingRules.length; i++) {
      var rule = stackingRules[i];
      var memberSet = new Set(rule.members);
      var inGroup = result.filter(function (t) { return memberSet.has(t.name); });
      var notInGroup = result.filter(function (t) { return !memberSet.has(t.name); });

      if (inGroup.length === 0) continue;

      var orderedGroup = inGroup.slice().sort(function (a, b) {
        return rule.members.indexOf(a.name) - rule.members.indexOf(b.name);
      });

      if (rule.type === "mutex") {
        result = notInGroup.concat([orderedGroup[0]]);
      } else if (rule.type === "max-one") {
        var maxEffect = orderedGroup.reduce(function (max, curr) {
          var maxVal = Math.abs(max.rateAdj || 0) + Math.abs(max.priceAdj || 0);
          var currVal = Math.abs(curr.rateAdj || 0) + Math.abs(curr.priceAdj || 0);
          return currVal > maxVal ? curr : max;
        });
        result = notInGroup.concat([maxEffect]);
      } else if (rule.type === "sum-cap") {
        if (rule.cap === undefined) continue;
        var totalRate = inGroup.reduce(function (s, t) { return s + (t.rateAdj || 0); }, 0);
        var totalPrice = inGroup.reduce(function (s, t) { return s + (t.priceAdj || 0); }, 0);

        if (Math.abs(totalRate) <= rule.cap && Math.abs(totalPrice) <= rule.cap) continue;

        var rateScale = Math.abs(totalRate) > rule.cap ? rule.cap / Math.abs(totalRate) : 1;
        var priceScale = Math.abs(totalPrice) > rule.cap ? rule.cap / Math.abs(totalPrice) : 1;

        var scaled = inGroup.map(function (t) {
          return Object.assign({}, t, {
            rateAdj: t.rateAdj !== undefined ? t.rateAdj * rateScale : undefined,
            priceAdj: t.priceAdj !== undefined ? t.priceAdj * priceScale : undefined,
          });
        });
        result = notInGroup.concat(scaled);
      }
    }

    return result;
  }

  // ── Extension cost ──

  function calculateExtensionCost(extensionCosts, extensionDays, category) {
    if (extensionDays <= 0 || extensionCosts.length === 0) return 0;

    var categoryCosts = extensionCosts.filter(function (c) { return c.category === category; });
    if (categoryCosts.length === 0) {
      categoryCosts = extensionCosts.filter(function (c) { return c.category === "all"; });
    }
    if (categoryCosts.length === 0) return 0;

    var sorted = categoryCosts.slice().sort(function (a, b) { return a.days - b.days; });
    var tier = sorted.find(function (c) { return c.days >= extensionDays; });
    if (tier) return tier.cost;
    return sorted[sorted.length - 1].cost;
  }

  // ── Lock day adjustment ──

  function getLockDayAdjustment(lockDayPrices, lockDays, category) {
    if (!lockDayPrices) return 0;
    var config = lockDayPrices[String(lockDays)];
    if (!config) return 0;
    if (config.appliesTo && config.appliesTo.length > 0 && config.appliesTo.indexOf(category) === -1) {
      return 0;
    }
    return config.adjustment;
  }

  // ── Calculate single option ──

  function calculateOption(baseRate, adjustments, extensionCosts, lockDayPrices, params) {
    var category = baseRate.category;
    var rateAdj = 0;
    var priceAdj = 0;

    for (var i = 0; i < adjustments.length; i++) {
      rateAdj += adjustments[i].rateAdj || 0;
      priceAdj += adjustments[i].priceAdj || 0;
    }

    var finalRate = baseRate.rate + rateAdj;
    var lockDayAdj = getLockDayAdjustment(lockDayPrices, params.lockDays, category);
    var extensionCost = calculateExtensionCost(extensionCosts, params.extensionDays, category);
    var finalPrice = baseRate.price + priceAdj + lockDayAdj - extensionCost;

    return {
      category: category,
      baseRate: baseRate.rate,
      basePrice: baseRate.price,
      finalRate: Math.round(finalRate * 1000) / 1000,
      finalPrice: Math.round(finalPrice * 1000) / 1000,
      adjustments: adjustments,
      lockDayAdj: lockDayAdj !== 0 ? Math.round(lockDayAdj * 1000) / 1000 : undefined,
      extensionCost: extensionCost !== 0 ? Math.round(extensionCost * 1000) / 1000 : undefined,
    };
  }

  // ── Core SOP ──

  function runPricingSOPCore(input) {
    try {
      var baseRates = input.baseRates;
      var adjustments = input.adjustments || [];
      var llpaMatrices = input.llpaMatrices || [];
      var stackingRules = input.stackingRules || [];
      var extensionCosts = input.extensionCosts || [];
      var lockDayPrices = input.lockDayPrices;
      var fieldValues = input.fieldValues;
      var lockDays = input.lockDays !== undefined ? input.lockDays : ENGINE_DEFAULTS.lockDays;
      var extensionDays = input.extensionDays !== undefined ? input.extensionDays : ENGINE_DEFAULTS.extensionDays;

      var options = [];
      var skippedMap = new Map();

      var matrixTriggered = lookupLLPAMatrices(llpaMatrices, fieldValues);

      for (var i = 0; i < baseRates.length; i++) {
        var baseRate = baseRates[i];

        if (baseRate.when) {
          var skipCheck = shouldSkipAdjustment(baseRate.when, fieldValues);
          if (!skipCheck.skip && !evaluateExpression(baseRate.when, fieldValues)) continue;
        }

        var category = baseRate.category;
        var evalResult = evaluateAdjustments(adjustments, fieldValues, category);

        for (var si = 0; si < evalResult.skipped.length; si++) {
          var s = evalResult.skipped[si];
          var existing = skippedMap.get(s.name);
          if (existing) {
            for (var fi = 0; fi < s.missingFields.length; fi++) {
              if (existing.missingFields.indexOf(s.missingFields[fi]) === -1) {
                existing.missingFields.push(s.missingFields[fi]);
              }
            }
          } else {
            skippedMap.set(s.name, Object.assign({}, s, { missingFields: s.missingFields.slice() }));
          }
        }

        var allTriggered = evalResult.triggered.concat(matrixTriggered);
        var filtered = applyStackingRules(allTriggered, stackingRules);
        var option = calculateOption(baseRate, filtered, extensionCosts, lockDayPrices, {
          extensionDays: extensionDays,
          lockDays: lockDays,
        });

        options.push(option);
      }

      var skippedArray = Array.from(skippedMap.values());

      return {
        success: true,
        options: options,
        skippedAdjustments: skippedArray.length > 0 ? skippedArray : undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  // ── Public API ──

  return function pricingEngine(input) {
    var config = input.config;
    var fieldValues = {};
    var keys = Object.keys(input);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key !== "config" && key !== "lockDays" && key !== "extensionDays" && input[key] !== undefined) {
        fieldValues[key] = input[key];
      }
    }

    var lockDays = input.lockDays !== undefined ? input.lockDays : ENGINE_DEFAULTS.lockDays;
    var extensionDays = input.extensionDays !== undefined ? input.extensionDays : ENGINE_DEFAULTS.extensionDays;

    var result = runPricingSOPCore({
      baseRates: config.baseRates,
      adjustments: config.adjustments,
      llpaMatrices: config.llpaMatrices,
      stackingRules: config.stackingRules,
      extensionCosts: config.extensionCosts,
      lockDayPrices: config.lockDayPrices,
      fieldValues: fieldValues,
      lockDays: lockDays,
      extensionDays: extensionDays,
    });

    var productName = config.productName;
    var rateSheets = (config.rateSheets || []).slice();
    var options = result.options || [];

    var bestOption = null;
    if (options.length > 0) {
      bestOption = options.reduce(function (min, opt) {
        return opt.finalRate < min.finalRate ? opt : min;
      });
    }

    var message = result.success
      ? options.length > 0
        ? productName + ": " + options.length + " options. Best rate: " + bestOption.finalRate.toFixed(3) + "%"
        : productName + ": No options available"
      : productName + " Error: " + result.error;

    return {
      success: result.success,
      productName: productName,
      options: result.options,
      error: result.error,
      rateSheets: rateSheets,
      skippedAdjustments: result.skippedAdjustments,
      _uiRendered: true,
      _message: message,
    };
  };
}
