-- 规范化历史存量用户的 locale 字段，确保与 BCP-47 标准注册值 zh-CN 一致
UPDATE users SET locale = 'zh-CN' WHERE locale = 'zh' OR locale = 'zh-cn';
