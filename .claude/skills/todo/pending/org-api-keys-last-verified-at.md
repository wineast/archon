# org_api_keys 增加 last_verified_at 字段

当前无法知道用户配置的 BYOK key 是否仍然有效。增加 `last_verified_at` 字段，配合定期或按需验证机制，让用户知道 key 状态。
