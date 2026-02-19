function Component() {
  return function({ tool, state, isLoading, isComplete, isError }) {

  // ============================================================================
  // Breakdown Tooltip Component
  // ============================================================================

  function PriceBreakdownTooltip({ option }) {
    var adjustments = option.adjustments || [];
    var priceAdjustments = adjustments.filter(function (adj) {
      return adj.priceAdj !== undefined && adj.priceAdj !== 0;
    });
    var totalPriceAdj = priceAdjustments.reduce(function (sum, adj) {
      return sum + (adj.priceAdj || 0);
    }, 0);

    return (
      <div className="space-y-1.5 py-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Base</span>
          <span className="font-mono">{option.basePrice.toFixed(3)}</span>
        </div>

        {priceAdjustments.length > 0 && (
          <Fragment>
            {priceAdjustments.map(function (adj, idx) {
              return (
                <div key={idx} className="flex justify-between gap-4">
                  <span className="text-muted-foreground truncate max-w-[160px]" title={adj.name}>
                    {adj.name}
                  </span>
                  <span className={"font-mono " + ((adj.priceAdj || 0) < 0 ? "text-red-500" : (adj.priceAdj || 0) > 0 ? "text-green-500" : "")}>
                    {adj.priceAdj >= 0 ? "+" : ""}{adj.priceAdj.toFixed(3)}
                  </span>
                </div>
              );
            })}
            {priceAdjustments.length > 1 && (
              <div className="flex justify-between gap-4 text-muted-foreground text-[10px]">
                <span>Subtotal</span>
                <span className={"font-mono " + (totalPriceAdj < 0 ? "text-red-500" : totalPriceAdj > 0 ? "text-green-500" : "")}>
                  {totalPriceAdj >= 0 ? "+" : ""}{totalPriceAdj.toFixed(3)}
                </span>
              </div>
            )}
          </Fragment>
        )}

        {option.lockDayAdj !== undefined && option.lockDayAdj !== 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Lock Adj</span>
            <span className={"font-mono " + (option.lockDayAdj < 0 ? "text-red-500" : "text-green-500")}>
              {option.lockDayAdj >= 0 ? "+" : ""}{option.lockDayAdj.toFixed(3)}
            </span>
          </div>
        )}

        {option.extensionCost !== undefined && option.extensionCost !== 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Extension</span>
            <span className="font-mono text-red-500">-{option.extensionCost.toFixed(3)}</span>
          </div>
        )}

        <div className="border-t my-1" />
        <div className="flex justify-between gap-4 font-medium">
          <span>Final</span>
          <span className="font-mono">{option.finalPrice.toFixed(3)}</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Rate Column Tooltip
  // ============================================================================

  function RateColumnTooltip({ rate, categories, optionsByRate }) {
    var categoryOptions = categories
      .map(function (cat) { return { category: cat, option: optionsByRate[cat].get(rate) }; })
      .filter(function (item) { return item.option !== undefined; });

    var _activeTab = useState(0);
    var activeTab = _activeTab[0];
    var setActiveTab = _activeTab[1];

    if (categoryOptions.length === 0) return null;

    var current = categoryOptions[activeTab] || categoryOptions[0];
    var category = current.category;
    var option = current.option;
    var adjustments = option.adjustments || [];
    var rateAdjustments = adjustments.filter(function (adj) {
      return adj.rateAdj !== undefined && adj.rateAdj !== 0;
    });

    return (
      <div className="py-1 min-w-[180px]">
        {categoryOptions.length > 1 && (
          <div className="flex gap-1 mb-2 border-b pb-1">
            {categoryOptions.map(function (item, idx) {
              return (
                <button
                  key={item.category}
                  type="button"
                  onClick={function (e) { e.stopPropagation(); setActiveTab(idx); }}
                  className={"text-[10px] px-1.5 py-0.5 rounded transition-colors " + (
                    idx === activeTab
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  {item.category}
                </button>
              );
            })}
          </div>
        )}

        {categoryOptions.length === 1 && (
          <div className="text-[10px] uppercase tracking-wider text-white/60 font-medium mb-1">
            {category}
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Base</span>
            <span className="font-mono">{option.baseRate.toFixed(3)}%</span>
          </div>

          {rateAdjustments.length > 0 && (
            <Fragment>
              {rateAdjustments.map(function (adj, idx) {
                return (
                  <div key={idx} className="flex justify-between gap-4">
                    <span className="text-muted-foreground truncate max-w-[120px]" title={adj.name}>
                      {adj.name}
                    </span>
                    <span className={"font-mono " + ((adj.rateAdj || 0) > 0 ? "text-red-500" : "text-green-500")}>
                      {adj.rateAdj >= 0 ? "+" : ""}{adj.rateAdj.toFixed(3)}%
                    </span>
                  </div>
                );
              })}
            </Fragment>
          )}

          <div className="border-t my-1" />
          <div className="flex justify-between gap-4 font-medium">
            <span>Final</span>
            <span className="font-mono">{option.finalRate.toFixed(3)}%</span>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Helper functions
  // ============================================================================

  function calculatePointRebate(price) {
    if (price > 100) return { point: 0, rebate: price - 100 };
    if (price < 100) return { point: 100 - price, rebate: 0 };
    return { point: 0, rebate: 0 };
  }

  function formatNumber(value, decimals) {
    var d = decimals || 3;
    var formatted = value.toFixed(d);
    return formatted.replace(/\.?0+$/, "") || "0";
  }

  // ============================================================================
  // Spreadsheet Table
  // ============================================================================

  function SpreadsheetTable({ optionsByCategory, maxRowsPerCategory }) {
    var maxRows = maxRowsPerCategory || 10;
    var _showAll = useState(false);
    var showAll = _showAll[0];
    var setShowAll = _showAll[1];
    var categories = Object.keys(optionsByCategory);

    if (categories.length === 0) return null;

    var ratesByCategory = {};
    var totalHiddenRows = 0;

    for (var ci = 0; ci < categories.length; ci++) {
      var cat = categories[ci];
      var rates = optionsByCategory[cat]
        .map(function (opt) { return opt.finalRate; })
        .sort(function (a, b) { return a - b; });
      var uniqueRates = [];
      var seen = {};
      for (var ri = 0; ri < rates.length; ri++) {
        if (!seen[rates[ri]]) { uniqueRates.push(rates[ri]); seen[rates[ri]] = true; }
      }
      ratesByCategory[cat] = uniqueRates;
      if (uniqueRates.length > maxRows) totalHiddenRows += uniqueRates.length - maxRows;
    }

    var needsCollapse = totalHiddenRows > 0;

    var displayRatesSet = {};
    var displayRatesByCategory = {};

    for (var ci2 = 0; ci2 < categories.length; ci2++) {
      var cat2 = categories[ci2];
      var rates2 = ratesByCategory[cat2];
      var catDisplayRates = showAll ? rates2 : rates2.slice(0, maxRows);
      var catSet = {};
      for (var ri2 = 0; ri2 < catDisplayRates.length; ri2++) {
        catSet[catDisplayRates[ri2]] = true;
        displayRatesSet[catDisplayRates[ri2]] = true;
      }
      displayRatesByCategory[cat2] = catSet;
    }
    var sortedDisplayRates = Object.keys(displayRatesSet).map(Number).sort(function (a, b) { return a - b; });

    var optionsByRate = {};
    for (var ci3 = 0; ci3 < categories.length; ci3++) {
      var cat3 = categories[ci3];
      optionsByRate[cat3] = new Map();
      for (var oi = 0; oi < optionsByCategory[cat3].length; oi++) {
        var opt = optionsByCategory[cat3][oi];
        optionsByRate[cat3].set(opt.finalRate, opt);
      }
    }

    return (
      <div className="overflow-x-auto">
        <Table className="border">
          <TableHeader>
            <TableRow className="border-b">
              <TableHead rowSpan={2} className="text-xs text-center align-middle w-[70px] border-r">
                Rate
              </TableHead>
              {categories.map(function (cat, idx) {
                return (
                  <TableHead key={cat} colSpan={3} className={"text-xs font-medium text-center bg-muted/30" + (idx > 0 ? " border-l" : "")}>
                    {cat}
                  </TableHead>
                );
              })}
            </TableRow>
            <TableRow>
              {categories.map(function (cat, idx) {
                return (
                  <Fragment key={cat}>
                    <TableHead className={"text-xs text-right w-[70px]" + (idx > 0 ? " border-l" : "")}>Price</TableHead>
                    <TableHead className="text-xs text-right w-[60px]">Point</TableHead>
                    <TableHead className="text-xs text-right w-[60px]">Rebate</TableHead>
                  </Fragment>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDisplayRates.map(function (rate) {
              var hasAnyRateAdj = categories.some(function (cat) {
                if (!displayRatesByCategory[cat][rate]) return false;
                var opt = optionsByRate[cat].get(rate);
                if (!opt) return false;
                var adjs = opt.adjustments || [];
                return adjs.some(function (adj) { return adj.rateAdj !== undefined && adj.rateAdj !== 0; });
              });

              return (
                <TableRow key={rate}>
                  <TableCell className="text-xs text-center align-middle font-mono border-r">
                    {hasAnyRateAdj ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="border-b border-dashed border-muted-foreground/50 cursor-help">
                            {rate.toFixed(3)}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs max-w-[280px]">
                          <RateColumnTooltip rate={rate} categories={categories} optionsByRate={optionsByRate} />
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Fragment>{rate.toFixed(3)}%</Fragment>
                    )}
                  </TableCell>
                  {categories.map(function (cat, idx) {
                    var option = optionsByRate[cat].get(rate);
                    var isInDisplayRange = displayRatesByCategory[cat][rate];
                    if (!option || !isInDisplayRange) {
                      return (
                        <Fragment key={cat}>
                          <TableCell className={"text-xs" + (idx > 0 ? " border-l" : "")} />
                          <TableCell className="text-xs" />
                          <TableCell className="text-xs" />
                        </Fragment>
                      );
                    }
                    var pr = calculatePointRebate(option.finalPrice);
                    var adjustments = option.adjustments || [];
                    var hasPriceAdj = adjustments.some(function (adj) { return adj.priceAdj !== undefined && adj.priceAdj !== 0; });
                    var hasBreakdown = hasPriceAdj || (option.lockDayAdj !== undefined && option.lockDayAdj !== 0) || (option.extensionCost !== undefined && option.extensionCost !== 0);

                    return (
                      <Fragment key={cat}>
                        <TableCell className={"text-xs text-right font-mono" + (idx > 0 ? " border-l" : "")}>
                          {hasBreakdown ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="border-b border-dashed border-muted-foreground/50 cursor-help">
                                  {option.finalPrice.toFixed(3)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[280px]">
                                <PriceBreakdownTooltip option={option} />
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            option.finalPrice.toFixed(3)
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {pr.point > 0 ? formatNumber(pr.point) : "0"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {pr.rebate > 0 ? formatNumber(pr.rebate) : "0"}
                        </TableCell>
                      </Fragment>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {needsCollapse && (
          <button
            type="button"
            onClick={function () { setShowAll(!showAll); }}
            className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t flex items-center justify-center gap-1"
          >
            {showAll ? (
              <Fragment>
                <ChevronRight className="h-3 w-3 -rotate-90" />
                Show fewer rates
              </Fragment>
            ) : (
              <Fragment>
                <ChevronRight className="h-3 w-3 rotate-90" />
                Show {totalHiddenRows} more rate{totalHiddenRows > 1 ? "s" : ""}
              </Fragment>
            )}
          </button>
        )}
      </div>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  var result = tool.output;
  var args = tool.input;

  if (isLoading || !result) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Spinner className="h-3 w-3" />
        <span>Calculating pricing...</span>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="text-xs text-muted-foreground">
        Pricing Error: {result.error || "Unknown error"}
      </div>
    );
  }

  var options = result.options || [];

  if (options.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Pricing: No options available
      </div>
    );
  }

  var productName = result.productName || "Options";

  var optionsByCategory = {};
  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    var cat = opt.category || productName;
    if (!optionsByCategory[cat]) optionsByCategory[cat] = [];
    optionsByCategory[cat].push(opt);
  }

  var _selectedSheet = useState(null);
  var selectedSheet = _selectedSheet[0];
  var setSelectedSheet = _selectedSheet[1];
  var rateSheets = result.rateSheets || [];
  var skippedAdjustments = result.skippedAdjustments;

  return (
    <div>
      <div className="border rounded-lg overflow-hidden divide-y">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="text-sm font-semibold text-foreground">{productName} Pricing</div>
          {rateSheets.length > 0 && (
            <RateSheetLinks rateSheets={rateSheets} onSelect={setSelectedSheet} />
          )}
        </div>

        <ResultSection>
          <SpreadsheetTable
            optionsByCategory={optionsByCategory}
          />
        </ResultSection>

        {skippedAdjustments && skippedAdjustments.length > 0 && (
          <div className="px-3 py-2">
            <div className="text-[10px] text-muted-foreground/70">
              {skippedAdjustments.length} adjustment(s) skipped due to missing fields
            </div>
          </div>
        )}

        {/* Debug JSON section removed in dynamic component */}
      </div>

      <RateSheetPanel
        selectedSheet={selectedSheet}
        onClose={function () { setSelectedSheet(null); }}
      />
    </div>
  );
}
}
