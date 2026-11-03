# 宿主兼容性
本次上游基线 v1.7.3.4，生产构建版本 v1.7.4-supdance.2，数据库 Schema 78。插件版本 2.0.1，配置 Schema 2。最小版本声明为 1.7.3，运行检查仅接受 1.7.3/1.7.4 系列及所需扩展存在；其他版本先恢复原生样式，不能仅凭版本号声称兼容。

必需接口为主题 Extension、Overlay Extension、脱敏 startup 诊断订阅、CSS Custom Properties 与减少动效查询。可选 WAAPI 缺失时无路由动画；CSS Layer 缺失使用根标记作用域；Popover 使用宿主 AntD 定位。浏览器诊断不再用 CSS.supports("@layer") 或硬编码宿主版本伪造健康状态。

升级时检查 compatibility.ts 与 baseline.json 的源文件/耦合点、运行模块测试、生产构建及 Router/主题回归，最后在候选环境验收。当前静态注册清单清除了实际不存在的历史 legal 文件条目，未替换法律页面业务。未来版本须再次验证，不能宣称自动永久兼容。

独立子域名不在单一 React 应用的控制范围；需要分别核实框架、认证、Token 分发和部署。没有核实的独立子站保持未验收。
