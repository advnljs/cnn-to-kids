# Debug模式使用说明

## 启用Debug模式

在浏览器中访问以下URL：
```
http://localhost:PORT/index.html?debug=true
```

或者如果使用文件协议：
```
file:///path/to/cnn-to-kids/index.html?debug=true
```

## Debug模式功能

### 1. 跳过所有动画
- **卷积动画**：不再逐格扫描，立即显示完整结果
- **池化动画**：不再逐格处理，立即显示完整结果
- **匹配动画**：不再逐个对比样本，立即显示所有结果
- **步骤延迟**：所有步骤之间的延迟（1000ms, 1500ms等）全部跳过

### 2. 视觉指示
- 页面右上角显示橙色标签："🐛 Debug模式"
- 标签固定定位，始终可见

### 3. 控制台日志
Debug模式启动时，控制台会输出：
```
🐛 Debug模式已启用 - 将跳过动画直接显示结果
```

## 使用场景

### 开发调试
- 快速测试识别结果，无需等待动画
- 快速验证特征提取逻辑
- 快速收集训练样本

### 性能测试
- 测量不含动画的纯计算时间
- 对比不同特征提取方法的性能

### 批量测试
- 快速测试多个样本的识别效果
- 快速建立训练集

### 演示准备
- 快速跳转到结果页面进行截图
- 快速验证训练数据是否正确

## 技术实现

### 全局变量
```javascript
const DEBUG_MODE = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === 'true';
})();
```

### 延迟跳过
所有延迟方法都会检查DEBUG_MODE：
```javascript
delay(ms) {
    if (DEBUG_MODE) {
        return Promise.resolve();
    }
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 动画跳过
所有动画循环都会检查DEBUG_MODE：
```javascript
// 延迟，创建动画效果（Debug模式下跳过）
if (!DEBUG_MODE) {
    await new Promise(resolve => setTimeout(resolve, speed));
}
```

## 关闭Debug模式

删除URL中的`?debug=true`参数，刷新页面即可。

## 注意事项

1. **不影响计算逻辑**：Debug模式只跳过动画和延迟，不改变任何计算和识别逻辑
2. **完整渲染**：所有可视化元素都会正常渲染，只是不展示逐步动画过程
3. **控制台日志**：Debug模式不会减少控制台输出，所有日志仍然会正常打印
4. **本地存储**：Debug模式不影响localStorage的读写操作

## 对比效果

### 正常模式
- 步骤1显示：1秒延迟
- 步骤2卷积：3个探测器 × 约5秒动画 = 15秒
- 步骤3池化：3个特征图 × 约3秒动画 = 9秒
- 步骤4匹配：样本数 × 200ms = (例如10个样本约2秒)
- 总计：约27秒

### Debug模式
- 所有步骤：<1秒
- 主要时间花费在计算和DOM渲染上

## 推荐用法

**学习/演示时**：使用正常模式，观察完整处理流程

**开发/测试时**：使用Debug模式，快速验证结果

**截图/文档时**：使用Debug模式，快速跳转到结果页
