# models 表增加定价字段

当前计费时模型价格靠代码层硬编码。建议在 models 表增加 `input_price_per_1m` / `output_price_per_1m` 等定价字段，便于动态调整而非改代码重新部署。
