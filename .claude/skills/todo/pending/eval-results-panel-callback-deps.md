# results-panel handleRunAllConfirm deps 补全

useCallback deps 缺少 allDbTools（通过 getEnabledToolNames 闭包引用），当前不会 stale 但应补全。
