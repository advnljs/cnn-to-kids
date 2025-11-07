// 训练数据管理类
class TrainingDataManager {
    constructor() {
        this.samples = [];  // 存储训练样本 {features, label, imageData}
        this.loadFromLocalStorage();
    }

    // 添加训练样本
    addSample(features, label, imageData) {
        this.samples.push({
            features: features,
            label: label,  // 'smile' 或 'sad'
            imageData: imageData,  // 用于显示缩略图
            timestamp: Date.now()
        });
        this.saveToLocalStorage();
    }

    // 删除样本
    removeSample(index) {
        this.samples.splice(index, 1);
        this.saveToLocalStorage();
    }

    // 清空所有样本
    clearAll() {
        this.samples = [];
        this.saveToLocalStorage();
    }

    // 获取所有样本
    getSamples() {
        return this.samples;
    }

    // 获取统计信息
    getStats() {
        const smileCount = this.samples.filter(s => s.label === 'smile').length;
        const sadCount = this.samples.filter(s => s.label === 'sad').length;
        return {
            total: this.samples.length,
            smileCount,
            sadCount
        };
    }

    // 保存到localStorage
    saveToLocalStorage() {
        try {
            // 保存features、label和简化的imageData（用于可视化）
            const samplesToSave = this.samples.map(s => {
                let imageDataToSave = null;

                // 如果有imageData，保存为base64字符串（缩小版）
                if (s.imageData) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 80;
                    canvas.height = 80;
                    const ctx = canvas.getContext('2d');

                    // 绘制imageData到临时canvas
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = s.imageData.width;
                    tempCanvas.height = s.imageData.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.putImageData(s.imageData, 0, 0);

                    // 缩小并转为base64
                    ctx.drawImage(tempCanvas, 0, 0, 80, 80);
                    imageDataToSave = canvas.toDataURL('image/png');
                }

                return {
                    features: s.features,
                    label: s.label,
                    imageDataURL: imageDataToSave
                };
            });
            localStorage.setItem('cnn_training_data', JSON.stringify(samplesToSave));
        } catch (e) {
            console.warn('无法保存训练数据到localStorage:', e);
        }
    }

    // 从localStorage加载
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('cnn_training_data');
            if (saved) {
                const loaded = JSON.parse(saved);

                // 加载数据，如果有imageDataURL则还原为ImageData
                this.samples = loaded.map(s => {
                    let imageData = null;

                    // 从base64还原imageData
                    if (s.imageDataURL) {
                        try {
                            const img = new Image();
                            img.src = s.imageDataURL;

                            const canvas = document.createElement('canvas');
                            canvas.width = 280;  // 原始大小
                            canvas.height = 280;
                            const ctx = canvas.getContext('2d');

                            // 同步绘制（因为是本地data URL）
                            ctx.drawImage(img, 0, 0, 280, 280);
                            imageData = ctx.getImageData(0, 0, 280, 280);
                        } catch (err) {
                            console.warn('还原imageData失败:', err);
                        }
                    }

                    return {
                        features: s.features,
                        label: s.label,
                        imageData: imageData,
                        timestamp: Date.now()
                    };
                });
            }
        } catch (e) {
            console.warn('无法从localStorage加载训练数据:', e);
        }
    }
}

// KNN分类器
class KNNClassifier {
    constructor(k = 3) {
        this.k = k;  // K近邻的K值
    }

    // 计算两个特征向量之间的欧氏距离
    static distance(features1, features2) {
        let sum = 0;
        for (let i = 0; i < features1.length; i++) {
            const diff = features1[i] - features2[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    // 将矩阵展平为特征向量
    static flattenFeatures(poolResults) {
        const features = [];
        // 按照固定顺序展平3个特征图
        for (let name of ['horizontal', 'vertical', 'edge']) {
            const matrix = poolResults[name];
            for (let row of matrix) {
                for (let val of row) {
                    features.push(val);
                }
            }
        }
        return features;
    }

    // 预测
    predict(features, trainingSamples) {
        if (trainingSamples.length === 0) {
            return null;
        }

        // 计算与所有训练样本的距离
        const distances = trainingSamples.map((sample, index) => ({
            index,
            label: sample.label,
            distance: KNNClassifier.distance(features, sample.features)
        }));

        // 按距离排序
        distances.sort((a, b) => a.distance - b.distance);

        // 取前K个最近的邻居
        const k = Math.min(this.k, distances.length);
        const neighbors = distances.slice(0, k);

        // 统计标签
        const labelCounts = {};
        let closestDistance = neighbors[0].distance;

        neighbors.forEach(neighbor => {
            labelCounts[neighbor.label] = (labelCounts[neighbor.label] || 0) + 1;
        });

        // 找出最多的标签
        let maxCount = 0;
        let predictedLabel = null;
        for (let label in labelCounts) {
            if (labelCounts[label] > maxCount) {
                maxCount = labelCounts[label];
                predictedLabel = label;
            }
        }

        // 计算置信度
        const confidence = Math.round((maxCount / k) * 100);

        return {
            label: predictedLabel,
            confidence: confidence,
            neighbors: neighbors,
            closestDistance: closestDistance
        };
    }
}

// 画板管理类
class DrawingBoard {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // 触摸支持
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();

        this.lastX = x;
        this.lastY = y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    clear() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    generateSmile() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 画脸轮廓
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
        this.ctx.stroke();

        // 画左眼
        this.ctx.beginPath();
        this.ctx.arc(centerX - 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        // 画右眼
        this.ctx.beginPath();
        this.ctx.arc(centerX + 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // 画微笑的嘴巴
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + 10, 60, 0.2 * Math.PI, 0.8 * Math.PI);
        this.ctx.stroke();
    }

    generateSad() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 画脸轮廓
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
        this.ctx.stroke();

        // 画左眼
        this.ctx.beginPath();
        this.ctx.arc(centerX - 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        // 画右眼
        this.ctx.beginPath();
        this.ctx.arc(centerX + 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // 画悲伤的嘴巴（倒转的弧）
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + 70, 60, 1.2 * Math.PI, 1.8 * Math.PI);
        this.ctx.stroke();
    }

    // 生成简化笑脸（无圆圈）
    generateSimpleSmile() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 画左眼
        this.ctx.beginPath();
        this.ctx.arc(centerX - 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        // 画右眼
        this.ctx.beginPath();
        this.ctx.arc(centerX + 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // 画微笑的嘴巴
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + 10, 60, 0.2 * Math.PI, 0.8 * Math.PI);
        this.ctx.stroke();
    }

    // 生成简化哭脸（无圆圈）
    generateSimpleSad() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 画左眼
        this.ctx.beginPath();
        this.ctx.arc(centerX - 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        // 画右眼
        this.ctx.beginPath();
        this.ctx.arc(centerX + 35, centerY - 30, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // 画悲伤的嘴巴（倒转的弧）
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + 70, 60, 1.2 * Math.PI, 1.8 * Math.PI);
        this.ctx.stroke();
    }

    getImageData() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}

// 图像处理类
class ImageProcessor {
    // 将图像数据转换为灰度矩阵（使用区域平均采样，减少失真）
    static toGrayscaleMatrix(imageData, targetSize = 28) {
        const { width, height, data } = imageData;
        const matrix = [];

        // 缩放比例
        const scaleX = width / targetSize;
        const scaleY = height / targetSize;

        for (let y = 0; y < targetSize; y++) {
            const row = [];
            for (let x = 0; x < targetSize; x++) {
                // 计算源图像中对应的区域范围
                const srcXStart = Math.floor(x * scaleX);
                const srcXEnd = Math.floor((x + 1) * scaleX);
                const srcYStart = Math.floor(y * scaleY);
                const srcYEnd = Math.floor((y + 1) * scaleY);

                // 区域平均采样：对源区域内的所有像素取平均值
                let graySum = 0;
                let count = 0;

                for (let sy = srcYStart; sy < srcYEnd; sy++) {
                    for (let sx = srcXStart; sx < srcXEnd; sx++) {
                        if (sx < width && sy < height) {
                            const idx = (sy * width + sx) * 4;
                            const r = data[idx];
                            const g = data[idx + 1];
                            const b = data[idx + 2];
                            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                            graySum += gray;
                            count++;
                        }
                    }
                }

                // 计算平均灰度值并归一化到 0-1
                const avgGray = count > 0 ? graySum / count : 255;
                row.push(avgGray / 255);
            }
            matrix.push(row);
        }

        return matrix;
    }

    // 卷积操作
    static convolve(matrix, kernel) {
        const inputSize = matrix.length;
        const kernelSize = kernel.length;
        const outputSize = inputSize - kernelSize + 1;
        const output = [];

        for (let y = 0; y < outputSize; y++) {
            const row = [];
            for (let x = 0; x < outputSize; x++) {
                let sum = 0;
                // 应用卷积核
                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        sum += matrix[y + ky][x + kx] * kernel[ky][kx];
                    }
                }
                row.push(Math.max(0, sum)); // ReLU 激活
            }
            output.push(row);
        }

        return output;
    }

    // 最大池化
    static maxPool(matrix, poolSize = 2) {
        const inputSize = matrix.length;
        const outputSize = Math.floor(inputSize / poolSize);
        const output = [];

        for (let y = 0; y < outputSize; y++) {
            const row = [];
            for (let x = 0; x < outputSize; x++) {
                let maxVal = -Infinity;
                // 在池化窗口中找最大值
                for (let py = 0; py < poolSize; py++) {
                    for (let px = 0; px < poolSize; px++) {
                        const val = matrix[y * poolSize + py][x * poolSize + px];
                        maxVal = Math.max(maxVal, val);
                    }
                }
                row.push(maxVal);
            }
            output.push(row);
        }

        return output;
    }

    // 规范化矩阵值到 0-1
    static normalize(matrix) {
        let max = -Infinity;
        let min = Infinity;

        for (let row of matrix) {
            for (let val of row) {
                max = Math.max(max, val);
                min = Math.min(min, val);
            }
        }

        if (max === min) return matrix;

        return matrix.map(row =>
            row.map(val => (val - min) / (max - min))
        );
    }
}

// 可视化类
class Visualizer {
    // 在 canvas 上绘制矩阵
    static drawMatrix(canvas, matrix, cellSize = 10, highlightPos = null) {
        const ctx = canvas.getContext('2d');
        const height = matrix.length;
        const width = matrix[0].length;

        canvas.width = width * cellSize;
        canvas.height = height * cellSize;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const value = Math.floor(matrix[y][x] * 255);
                ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // 绘制高亮区域（卷积核扫描位置）
        if (highlightPos) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.strokeRect(
                highlightPos.x * cellSize,
                highlightPos.y * cellSize,
                highlightPos.size * cellSize,
                highlightPos.size * cellSize
            );
        }

        // 绘制网格线
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, height * cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(width * cellSize, y * cellSize);
            ctx.stroke();
        }
    }

    // 绘制卷积核
    static drawKernel(canvas, kernel) {
        const ctx = canvas.getContext('2d');
        const size = kernel.length;
        const cellSize = 30;

        canvas.width = size * cellSize;
        canvas.height = size * cellSize;

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const value = kernel[y][x];

                // 根据值设置颜色
                if (value > 0) {
                    ctx.fillStyle = `rgba(102, 126, 234, ${Math.abs(value)})`;
                } else if (value < 0) {
                    ctx.fillStyle = `rgba(234, 102, 102, ${Math.abs(value)})`;
                } else {
                    ctx.fillStyle = '#ffffff';
                }

                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

                // 绘制边框
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);

                // 绘制数值
                ctx.fillStyle = '#333';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    value.toFixed(1),
                    x * cellSize + cellSize / 2,
                    y * cellSize + cellSize / 2
                );
            }
        }
    }

    // 绘制热力图（彩色，用于显示特征强度）
    static drawHeatmap(canvas, matrix, cellSize = 10, highlightPos = null) {
        const ctx = canvas.getContext('2d');
        const height = matrix.length;
        const width = matrix[0].length;

        canvas.width = width * cellSize;
        canvas.height = height * cellSize;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const value = matrix[y][x];
                // 使用热力图配色：蓝色（低）→ 绿色 → 黄色 → 红色（高）
                const color = Visualizer.valueToHeatColor(value);
                ctx.fillStyle = color;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // 绘制高亮区域
        if (highlightPos) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.strokeRect(
                highlightPos.x * cellSize,
                highlightPos.y * cellSize,
                highlightPos.size * cellSize,
                highlightPos.size * cellSize
            );
        }

        // 绘制网格线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, height * cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(width * cellSize, y * cellSize);
            ctx.stroke();
        }
    }

    // 将值转换为热力图颜色
    static valueToHeatColor(value) {
        // value 范围 0-1
        if (value < 0.25) {
            // 深蓝 → 浅蓝
            const t = value / 0.25;
            const r = Math.floor(0 + t * 0);
            const g = Math.floor(0 + t * 100);
            const b = Math.floor(139 + t * 116);
            return `rgb(${r}, ${g}, ${b})`;
        } else if (value < 0.5) {
            // 浅蓝 → 绿色
            const t = (value - 0.25) / 0.25;
            const r = Math.floor(0 + t * 0);
            const g = Math.floor(100 + t * 155);
            const b = Math.floor(255 - t * 255);
            return `rgb(${r}, ${g}, ${b})`;
        } else if (value < 0.75) {
            // 绿色 → 黄色
            const t = (value - 0.5) / 0.25;
            const r = Math.floor(0 + t * 255);
            const g = Math.floor(255);
            const b = Math.floor(0);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // 黄色 → 红色
            const t = (value - 0.75) / 0.25;
            const r = Math.floor(255);
            const g = Math.floor(255 - t * 255);
            const b = Math.floor(0);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    // 动画展示卷积过程
    static async animateConvolution(inputCanvas, outputCanvas, matrix, kernel, cellSize = 8, speed = 50) {
        const inputSize = matrix.length;
        const kernelSize = kernel.length;
        const outputSize = inputSize - kernelSize + 1;
        const outputMatrix = Array(outputSize).fill(0).map(() => Array(outputSize).fill(0));

        // 设置输出画布
        const outCtx = outputCanvas.getContext('2d');
        outputCanvas.width = outputSize * cellSize;
        outputCanvas.height = outputSize * cellSize;

        // 逐个位置扫描
        for (let y = 0; y < outputSize; y++) {
            for (let x = 0; x < outputSize; x++) {
                // 计算卷积值
                let sum = 0;
                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        sum += matrix[y + ky][x + kx] * kernel[ky][kx];
                    }
                }
                const value = Math.max(0, sum); // ReLU
                outputMatrix[y][x] = value;

                // 在输入图像上高亮当前扫描位置
                Visualizer.drawMatrix(inputCanvas, matrix, cellSize, {
                    x: x,
                    y: y,
                    size: kernelSize
                });

                // 更新输出矩阵
                Visualizer.drawPartialMatrix(outputCanvas, outputMatrix, cellSize, x, y);

                // 延迟，创建动画效果
                await new Promise(resolve => setTimeout(resolve, speed));
            }
        }

        // 返回归一化的输出矩阵
        return ImageProcessor.normalize(outputMatrix);
    }

    // 绘制部分矩阵（用于动画）
    static drawPartialMatrix(canvas, matrix, cellSize, upToX, upToY, useHeatmap = false) {
        const ctx = canvas.getContext('2d');

        // 找到当前的最大最小值用于归一化
        let max = -Infinity;
        let min = Infinity;
        for (let y = 0; y <= upToY; y++) {
            const endX = y === upToY ? upToX : matrix[0].length - 1;
            for (let x = 0; x <= endX; x++) {
                max = Math.max(max, matrix[y][x]);
                min = Math.min(min, matrix[y][x]);
            }
        }

        const range = max - min || 1;

        // 绘制到目前为止的所有格子
        for (let y = 0; y <= upToY; y++) {
            const endX = y === upToY ? upToX : matrix[0].length - 1;
            for (let x = 0; x <= endX; x++) {
                const normalized = (matrix[y][x] - min) / range;

                if (useHeatmap) {
                    ctx.fillStyle = Visualizer.valueToHeatColor(normalized);
                } else {
                    const value = Math.floor(normalized * 255);
                    ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
                }
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // 高亮当前格子
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.strokeRect(upToX * cellSize, upToY * cellSize, cellSize, cellSize);

        // 绘制网格
        ctx.strokeStyle = useHeatmap ? 'rgba(255, 255, 255, 0.3)' : 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= matrix[0].length; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, matrix.length * cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= matrix.length; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(matrix[0].length * cellSize, y * cellSize);
            ctx.stroke();
        }
    }

    // 动画展示卷积过程（热力图版本）
    static async animateConvolutionHeatmap(inputCanvas, outputCanvas, matrix, kernel, cellSize = 12, speed = 50) {
        const inputSize = matrix.length;
        const kernelSize = kernel.length;
        const outputSize = inputSize - kernelSize + 1;
        const outputMatrix = Array(outputSize).fill(0).map(() => Array(outputSize).fill(0));

        // 设置输出画布
        const outCtx = outputCanvas.getContext('2d');
        outputCanvas.width = outputSize * cellSize;
        outputCanvas.height = outputSize * cellSize;

        // 逐个位置扫描
        for (let y = 0; y < outputSize; y++) {
            for (let x = 0; x < outputSize; x++) {
                // 计算卷积值
                let sum = 0;
                for (let ky = 0; ky < kernelSize; ky++) {
                    for (let kx = 0; kx < kernelSize; kx++) {
                        sum += matrix[y + ky][x + kx] * kernel[ky][kx];
                    }
                }
                const value = Math.max(0, sum); // ReLU
                outputMatrix[y][x] = value;

                // 在输入图像上高亮当前扫描位置（使用热力图）
                Visualizer.drawHeatmap(inputCanvas, matrix, cellSize, {
                    x: x,
                    y: y,
                    size: kernelSize
                });

                // 更新输出矩阵（使用热力图）
                Visualizer.drawPartialMatrix(outputCanvas, outputMatrix, cellSize, x, y, true);

                // 延迟，创建动画效果
                await new Promise(resolve => setTimeout(resolve, speed));
            }
        }

        // 返回归一化的输出矩阵
        return ImageProcessor.normalize(outputMatrix);
    }

    // 动画展示池化过程
    static async animatePooling(inputCanvas, outputCanvas, matrix, poolSize, inputCellSize = 8, outputCellSize = 8, speed = 100, useHeatmap = false) {
        const inputSize = matrix.length;
        const outputSize = Math.floor(inputSize / poolSize);
        const outputMatrix = Array(outputSize).fill(0).map(() => Array(outputSize).fill(0));

        const outCtx = outputCanvas.getContext('2d');
        outputCanvas.width = outputSize * outputCellSize;
        outputCanvas.height = outputSize * outputCellSize;

        const inCtx = inputCanvas.getContext('2d');

        for (let y = 0; y < outputSize; y++) {
            for (let x = 0; x < outputSize; x++) {
                // 找到池化窗口中的最大值
                let maxVal = -Infinity;
                for (let py = 0; py < poolSize; py++) {
                    for (let px = 0; px < poolSize; px++) {
                        const val = matrix[y * poolSize + py][x * poolSize + px];
                        maxVal = Math.max(maxVal, val);
                    }
                }
                outputMatrix[y][x] = maxVal;

                // 在输入图像上高亮当前池化窗口
                if (useHeatmap) {
                    Visualizer.drawHeatmap(inputCanvas, matrix, inputCellSize, {
                        x: x * poolSize,
                        y: y * poolSize,
                        size: poolSize
                    });
                } else {
                    Visualizer.drawMatrix(inputCanvas, matrix, inputCellSize, {
                        x: x * poolSize,
                        y: y * poolSize,
                        size: poolSize
                    });
                }

                // 更新输出矩阵
                Visualizer.drawPartialMatrix(outputCanvas, outputMatrix, outputCellSize, x, y, useHeatmap);

                await new Promise(resolve => setTimeout(resolve, speed));
            }
        }

        return outputMatrix;
    }
}

// CNN 处理流程类
class CNNProcessor {
    constructor(drawingBoard) {
        this.drawingBoard = drawingBoard;
        this.stepsContainer = document.getElementById('stepsContainer');
        this.finalResult = document.getElementById('finalResult');
        this.resultContent = document.getElementById('resultContent');

        // 训练相关
        this.trainingManager = new TrainingDataManager();
        this.classifier = new KNNClassifier(3);
        this.lastPoolResults = null;  // 保存最后一次的池化结果，用于训练

        // 定义特征探测器（卷积核）
        this.kernels = {
            horizontal: [
                [-1, -1, -1],
                [ 2,  2,  2],
                [-1, -1, -1]
            ],
            vertical: [
                [-1, 2, -1],
                [-1, 2, -1],
                [-1, 2, -1]
            ],
            edge: [
                [-1, -1, -1],
                [-1,  8, -1],
                [-1, -1, -1]
            ]
        };
    }

    async process() {
        // 清空之前的结果
        this.stepsContainer.innerHTML = '';
        this.finalResult.style.display = 'none';

        // 获取图像数据
        const imageData = this.drawingBoard.getImageData();
        const grayMatrix = ImageProcessor.toGrayscaleMatrix(imageData, 28);

        // 步骤1：显示原始图像
        await this.showStep1(grayMatrix);
        await this.delay(1000);

        // 步骤2：卷积 - 特征探测
        const convResults = await this.showStep2(grayMatrix);
        await this.delay(1500);

        // 步骤3：池化 - 信息压缩（用热力图显示）
        const poolResults = await this.showStep3(convResults);
        this.lastPoolResults = poolResults;  // 保存用于训练
        await this.delay(1500);

        // 步骤4：分类判断
        await this.showStep4(grayMatrix, poolResults);
    }

    async showStep1(matrix) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>📸 步骤 1：看到图像</h3>
            <div class="step-description">
                计算机把你的画分成了一个 28×28 的小格子网格，每个格子记录了它的"黑白程度"。
                白色格子的值接近 1，黑色格子的值接近 0。
            </div>
            <div class="visualization">
                <div class="grid-display">
                    <div class="grid-title">原始图像网格 (28×28)</div>
                    <canvas id="originalMatrix"></canvas>
                </div>
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);
        const canvas = document.getElementById('originalMatrix');
        Visualizer.drawMatrix(canvas, matrix, 8);
    }

    async showStep2(matrix) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>🔍 步骤 2：特征探测器工作</h3>
            <div class="step-description">
                现在使用3个特别的"特征探测器"来扫描图像！<br>
                • <strong>横线探测器</strong>：专门找横着的线条（比如嘴巴）<br>
                • <strong>竖线探测器</strong>：专门找竖着的线条（比如鼻子）<br>
                • <strong>边缘探测器</strong>：专门找边缘轮廓（比如脸的边缘）<br><br>
                👀 <strong>看！红色方框就是探测器，它在图像上一格一格地扫描！</strong>
            </div>
            <div class="visualization" id="convViz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('convViz');

        const kernelConfigs = [
            { name: 'horizontal', label: '横线探测器', desc: '扫描中...' },
            { name: 'vertical', label: '竖线探测器', desc: '扫描中...' },
            { name: 'edge', label: '边缘探测器', desc: '扫描中...' }
        ];

        for (let config of kernelConfigs) {
            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${config.label}</div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">探测器扫描</div>
                        <canvas id="input_${config.name}"></canvas>
                    </div>
                    <div class="arrow">→</div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">提取的特征</div>
                        <canvas id="output_${config.name}"></canvas>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">探测器样子（3×3）</div>
                    <canvas id="kernel_${config.name}"></canvas>
                </div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(100);

            // 绘制卷积核
            const kernelCanvas = document.getElementById(`kernel_${config.name}`);
            Visualizer.drawKernel(kernelCanvas, this.kernels[config.name]);

            // 执行动画卷积
            const inputCanvas = document.getElementById(`input_${config.name}`);
            const outputCanvas = document.getElementById(`output_${config.name}`);
            const result = await Visualizer.animateConvolution(
                inputCanvas,
                outputCanvas,
                matrix,
                this.kernels[config.name],
                8,
                20  // 速度：20ms 每步
            );

            results[config.name] = result;
        }

        return results;
    }

    async showStep3(convResults) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>📦 步骤 3：信息压缩（池化）</h3>
            <div class="step-description">
                图像太大了，处理起来太慢！我们用"取最强信号"的方法来压缩。<br>
                把每 2×2 的格子合并成 1 个格子，只保留最强的信号（最大的数值）。<br>
                🌈 <strong>用热力图显示：红色=强特征，蓝色=弱特征</strong>
            </div>
            <div class="visualization" id="poolViz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('poolViz');

        for (let [name, matrix] of Object.entries(convResults)) {
            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${name} 特征压缩</div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">压缩前（灰度）</div>
                        <canvas id="poolInput_${name}"></canvas>
                    </div>
                    <div class="arrow">→</div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">压缩后（热力图）</div>
                        <canvas id="poolOutput_${name}"></canvas>
                    </div>
                </div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(100);

            // 执行动画池化（输出用热力图）
            const inputCanvas = document.getElementById(`poolInput_${name}`);
            const outputCanvas = document.getElementById(`poolOutput_${name}`);
            const pooled = await Visualizer.animatePooling(
                inputCanvas,
                outputCanvas,
                matrix,
                2,  // 池化大小
                6,  // 输入单元格较小（26×26矩阵）
                12, // 输出单元格较大（13×13矩阵）
                30,  // 速度：30ms 每步
                true // 输出使用热力图
            );

            results[name] = pooled;
        }

        return results;
    }

    async showStep4(originalMatrix, poolResults) {
        const step = document.createElement('div');
        step.className = 'step';

        // 检查是否使用训练模式
        const trainingSamples = this.trainingManager.getSamples();
        const useTraining = trainingSamples.length >= 2;

        step.innerHTML = `
            <h3>🎯 步骤 4：最终判断</h3>
            <div class="step-description">
                ${useTraining ?
                    '现在使用<strong>KNN算法</strong>，找到最相似的训练样本！<br>计算机会把当前图像的特征与所有训练样本对比，找出最像的几个。' :
                    '现在把所有提取的特征综合起来判断：这是什么表情？<br>计算机会根据它"学过"的规律来做判断：<br>• 如果横线探测器在嘴巴<strong>上半部</strong>找到更强的特征 → 笑脸 😊<br>• 如果在嘴巴<strong>下半部</strong>找到更强的特征 → 哭脸 😢'
                }
            </div>
            ${useTraining ? '<div id="matchingAnimation" class="matching-animation"></div>' : ''}
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(500);

        // 如果使用训练模式，显示匹配动画
        if (useTraining) {
            await this.showMatchingAnimation(poolResults);
        }

        // 分类逻辑
        const result = this.classify(originalMatrix, poolResults);

        this.finalResult.style.display = 'block';

        let resultHTML = `
            <div style="font-size: 3em; margin: 20px 0;">${result.emoji}</div>
            <div style="font-size: 1.5em; margin-bottom: 20px;">
                识别结果：<strong>${result.label}</strong>
            </div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${result.confidence}%;">
                    ${result.confidence}% 确定
                </div>
            </div>
            <div style="margin-top: 20px; font-size: 1em; line-height: 1.8;">
                ${result.reason}
            </div>
        `;

        // 如果使用了训练模式，显示最相似的样本
        if (result.usedTraining && result.neighbors) {
            resultHTML += await this.showSimilarSamples(result.neighbors, result.label);
        }

        this.resultContent.innerHTML = resultHTML;
    }

    // 显示匹配动画
    async showMatchingAnimation(poolResults) {
        const container = document.getElementById('matchingAnimation');
        if (!container) return;

        container.innerHTML = `
            <div style="padding: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; margin-top: 15px;">
                <div style="font-size: 1.2em; margin-bottom: 15px; text-align: center;">
                    🔍 正在与训练样本逐个比对特征...
                </div>

                <!-- 当前识别的图像 -->
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 0.95em; color: rgba(255,255,255,0.9); margin-bottom: 8px;">
                        📸 当前要识别的图像
                    </div>
                    <canvas id="currentImagePreview" style="border: 3px solid #667eea; border-radius: 8px; background: white;"></canvas>
                </div>

                <!-- 匹配对比区域 -->
                <div id="matchingComparisonArea" style="display: flex; align-items: center; justify-content: center; gap: 20px; margin: 20px 0; min-height: 120px;">
                    <div style="text-align: center;">
                        <canvas id="currentFeaturePreview" width="80" height="80" style="border: 2px solid #667eea; border-radius: 8px; background: white;"></canvas>
                        <div style="font-size: 0.8em; margin-top: 5px; color: rgba(255,255,255,0.8);">当前图像</div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div id="matchingArrow" style="font-size: 2em; color: #ffc107; animation: arrowBounce 1s ease-in-out infinite;">⟷</div>
                        <div id="distanceValue" style="font-size: 0.85em; color: rgba(255,255,255,0.9); margin-top: 5px;">计算中...</div>
                    </div>

                    <div id="comparingSampleContainer" style="text-align: center;">
                        <canvas id="comparingSample" width="80" height="80" style="border: 2px solid #ffc107; border-radius: 8px; background: white;"></canvas>
                        <div style="font-size: 0.8em; margin-top: 5px; color: rgba(255,255,255,0.8);" id="comparingLabel">训练样本</div>
                    </div>
                </div>

                <!-- 进度条 -->
                <div class="matching-progress">
                    <div class="progress-bar" id="matchingProgressBar"></div>
                </div>
                <div id="matchingStatus" style="margin-top: 10px; font-size: 0.9em; color: rgba(255,255,255,0.8); text-align: center;">
                    准备开始对比...
                </div>

                <!-- 已对比的样本预览 -->
                <div id="comparedSamplesPreview" style="margin-top: 15px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
                </div>
            </div>
        `;

        // 绘制当前图像预览
        const currentCanvas = document.getElementById('currentImagePreview');
        const currentCtx = currentCanvas.getContext('2d');
        currentCanvas.width = 100;
        currentCanvas.height = 100;
        const currentImageData = this.drawingBoard.getImageData();
        currentCtx.drawImage(
            (() => {
                const temp = document.createElement('canvas');
                temp.width = currentImageData.width;
                temp.height = currentImageData.height;
                const tempCtx = temp.getContext('2d');
                tempCtx.putImageData(currentImageData, 0, 0);
                return temp;
            })(),
            0, 0, 100, 100
        );

        // 绘制当前特征预览（小尺寸）
        const currentFeatureCanvas = document.getElementById('currentFeaturePreview');
        const currentFeatureCtx = currentFeatureCanvas.getContext('2d');
        currentFeatureCtx.drawImage(
            (() => {
                const temp = document.createElement('canvas');
                temp.width = currentImageData.width;
                temp.height = currentImageData.height;
                const tempCtx = temp.getContext('2d');
                tempCtx.putImageData(currentImageData, 0, 0);
                return temp;
            })(),
            0, 0, 80, 80
        );

        const samples = this.trainingManager.getSamples();
        const currentFeatures = KNNClassifier.flattenFeatures(poolResults);
        const progressBar = document.getElementById('matchingProgressBar');
        const status = document.getElementById('matchingStatus');
        const comparingCanvas = document.getElementById('comparingSample');
        const comparingCtx = comparingCanvas.getContext('2d');
        const comparingLabel = document.getElementById('comparingLabel');
        const distanceValue = document.getElementById('distanceValue');
        const comparedPreview = document.getElementById('comparedSamplesPreview');

        let distances = [];

        // 动画展示匹配过程
        for (let i = 0; i < samples.length; i++) {
            const progress = ((i + 1) / samples.length) * 100;
            progressBar.style.width = `${progress}%`;

            const sample = samples[i];
            const distance = KNNClassifier.distance(currentFeatures, sample.features);
            const similarity = Math.max(0, 100 - distance * 10).toFixed(1);

            distances.push({ index: i, distance, similarity, label: sample.label });

            // 绘制正在对比的训练样本
            comparingCtx.fillStyle = 'white';
            comparingCtx.fillRect(0, 0, 80, 80);

            if (sample.imageData) {
                comparingCtx.drawImage(
                    (() => {
                        const temp = document.createElement('canvas');
                        temp.width = sample.imageData.width;
                        temp.height = sample.imageData.height;
                        const tempCtx = temp.getContext('2d');
                        tempCtx.putImageData(sample.imageData, 0, 0);
                        return temp;
                    })(),
                    0, 0, 80, 80
                );
            } else {
                comparingCtx.fillStyle = '#f0f0f0';
                comparingCtx.fillRect(0, 0, 80, 80);
                comparingCtx.fillStyle = '#666';
                comparingCtx.font = '12px Arial';
                comparingCtx.textAlign = 'center';
                comparingCtx.fillText('样本' + (i+1), 40, 40);
            }

            comparingLabel.textContent = `${sample.label === 'smile' ? '😊' : '😢'} 样本 ${i + 1}`;
            distanceValue.innerHTML = `距离: <strong>${distance.toFixed(2)}</strong><br>相似度: <strong>${similarity}%</strong>`;
            status.innerHTML = `🔍 对比样本 ${i + 1}/${samples.length} - 相似度: <strong style="color: #ffc107;">${similarity}%</strong>`;

            // 添加到已对比列表（小缩略图）
            const miniCanvas = document.createElement('canvas');
            miniCanvas.width = 40;
            miniCanvas.height = 40;
            miniCanvas.style.border = `2px solid ${similarity > 80 ? '#28a745' : similarity > 60 ? '#ffc107' : '#6c757d'}`;
            miniCanvas.style.borderRadius = '6px';
            miniCanvas.style.opacity = '0';
            miniCanvas.style.animation = 'fadeIn 0.3s ease forwards';
            miniCanvas.title = `样本${i+1}: ${similarity}%相似`;

            const miniCtx = miniCanvas.getContext('2d');
            if (sample.imageData) {
                miniCtx.drawImage(
                    (() => {
                        const temp = document.createElement('canvas');
                        temp.width = sample.imageData.width;
                        temp.height = sample.imageData.height;
                        const tempCtx = temp.getContext('2d');
                        tempCtx.putImageData(sample.imageData, 0, 0);
                        return temp;
                    })(),
                    0, 0, 40, 40
                );
            }
            comparedPreview.appendChild(miniCanvas);

            await this.delay(200);
        }

        // 排序找出最相似的
        distances.sort((a, b) => a.distance - b.distance);
        const topMatch = distances[0];
        const topSample = samples[topMatch.index];

        status.innerHTML = `✅ 对比完成！找到最相似样本（相似度: <strong style="color: #28a745;">${topMatch.similarity}%</strong>）`;

        // 重新绘制最相似的样本（修复bug：之前显示的是最后一个样本）
        comparingCtx.fillStyle = 'white';
        comparingCtx.fillRect(0, 0, 80, 80);

        if (topSample.imageData) {
            comparingCtx.drawImage(
                (() => {
                    const temp = document.createElement('canvas');
                    temp.width = topSample.imageData.width;
                    temp.height = topSample.imageData.height;
                    const tempCtx = temp.getContext('2d');
                    tempCtx.putImageData(topSample.imageData, 0, 0);
                    return temp;
                })(),
                0, 0, 80, 80
            );
        }

        comparingLabel.textContent = `${topSample.label === 'smile' ? '😊' : '😢'} 最相似样本`;
        distanceValue.innerHTML = `距离: <strong style="color: #28a745;">${topMatch.distance.toFixed(2)}</strong><br>相似度: <strong style="color: #28a745;">${topMatch.similarity}%</strong>`;

        // 高亮最相似的样本
        comparingCanvas.style.border = '3px solid #28a745';
        comparingCanvas.style.boxShadow = '0 0 20px rgba(40, 167, 69, 0.6)';

        await this.delay(1000);

        // 显示特征细节对比
        await this.showFeatureComparison(poolResults, topSample, topMatch, container);
    }

    // 显示特征细节对比
    async showFeatureComparison(currentPoolResults, topSample, topMatch, container) {
        const detailDiv = document.createElement('div');
        detailDiv.style.marginTop = '20px';
        detailDiv.style.padding = '20px';
        detailDiv.style.background = 'rgba(40, 167, 69, 0.1)';
        detailDiv.style.borderRadius = '10px';
        detailDiv.style.border = '2px solid rgba(40, 167, 69, 0.3)';
        detailDiv.innerHTML = `
            <h4 style="margin: 0 0 15px 0; text-align: center; color: rgba(255,255,255,0.95);">
                🔬 特征详细对比 - 为什么相似度是 ${topMatch.similarity}%？
            </h4>
            <div style="font-size: 0.9em; text-align: center; margin-bottom: 15px; color: rgba(255,255,255,0.85);">
                对比池化后的3个特征图（横线、竖线、边缘探测器的结果）
            </div>
            <div id="featureComparisonGrid"></div>
        `;

        container.appendChild(detailDiv);

        // 计算训练样本的池化结果（需要重新计算）
        const imageData = topSample.imageData || this.drawingBoard.getImageData();
        const grayMatrix = ImageProcessor.toGrayscaleMatrix(imageData, 28);

        // 为训练样本计算特征
        const sampleConvResults = {};
        for (let [name, kernel] of Object.entries(this.kernels)) {
            const convResult = ImageProcessor.convolve(grayMatrix, kernel);
            sampleConvResults[name] = ImageProcessor.normalize(convResult);
        }

        const samplePoolResults = {};
        for (let [name, matrix] of Object.entries(sampleConvResults)) {
            samplePoolResults[name] = ImageProcessor.maxPool(matrix, 2);
        }

        // 创建对比网格
        const grid = document.getElementById('featureComparisonGrid');
        if (!grid) return;

        const featureNames = [
            { key: 'horizontal', label: '横线探测器', emoji: '━' },
            { key: 'vertical', label: '竖线探测器', emoji: '┃' },
            { key: 'edge', label: '边缘探测器', emoji: '◇' }
        ];

        let gridHTML = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px;">';

        for (let feature of featureNames) {
            const currentMatrix = currentPoolResults[feature.key];
            const sampleMatrix = samplePoolResults[feature.key];

            // 计算这个特征的相似度（简单的矩阵差异）
            let totalDiff = 0;
            let count = 0;
            for (let y = 0; y < currentMatrix.length; y++) {
                for (let x = 0; x < currentMatrix[0].length; x++) {
                    const diff = Math.abs(currentMatrix[y][x] - sampleMatrix[y][x]);
                    totalDiff += diff;
                    count++;
                }
            }
            const avgDiff = totalDiff / count;
            const featureSimilarity = Math.max(0, (1 - avgDiff) * 100).toFixed(1);

            gridHTML += `
                <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                    <div style="text-align: center; font-weight: bold; margin-bottom: 8px; color: rgba(255,255,255,0.95);">
                        ${feature.emoji} ${feature.label}
                    </div>

                    <!-- 当前图像特征 -->
                    <div style="margin-bottom: 8px;">
                        <div style="font-size: 0.8em; color: rgba(255,255,255,0.8); margin-bottom: 4px;">当前图像</div>
                        <canvas id="currentFeature_${feature.key}" style="width: 100%; border-radius: 4px; image-rendering: pixelated;"></canvas>
                    </div>

                    <!-- 训练样本特征 -->
                    <div style="margin-bottom: 8px;">
                        <div style="font-size: 0.8em; color: rgba(255,255,255,0.8); margin-bottom: 4px;">训练样本</div>
                        <canvas id="sampleFeature_${feature.key}" style="width: 100%; border-radius: 4px; image-rendering: pixelated;"></canvas>
                    </div>

                    <!-- 相似度条 -->
                    <div style="margin-top: 10px;">
                        <div style="font-size: 0.85em; text-align: center; margin-bottom: 4px; color: rgba(255,255,255,0.9);">
                            匹配度: <strong>${featureSimilarity}%</strong>
                        </div>
                        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${featureSimilarity}%; height: 100%; background: linear-gradient(90deg, #28a745, #20c997); border-radius: 4px; transition: width 1s ease;"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        gridHTML += '</div>';

        // 添加总结
        gridHTML += `
            <div style="margin-top: 15px; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px; text-align: center;">
                <div style="font-size: 0.9em; color: rgba(255,255,255,0.9); line-height: 1.6;">
                    💡 <strong>如何计算总相似度？</strong><br>
                    将3个特征图展平成一个长向量（507维），然后计算两个向量之间的<strong>欧氏距离</strong>。<br>
                    距离越小 → 特征越接近 → 相似度越高！
                </div>
            </div>
        `;

        grid.innerHTML = gridHTML;

        // 绘制热力图
        await this.delay(100); // 等待DOM渲染

        for (let feature of featureNames) {
            const currentCanvas = document.getElementById(`currentFeature_${feature.key}`);
            const sampleCanvas = document.getElementById(`sampleFeature_${feature.key}`);

            if (currentCanvas) {
                Visualizer.drawHeatmap(currentCanvas, currentPoolResults[feature.key], 8);
            }
            if (sampleCanvas) {
                Visualizer.drawHeatmap(sampleCanvas, samplePoolResults[feature.key], 8);
            }
        }
    }

    // 显示最相似的样本
    async showSimilarSamples(neighbors, predictedLabel) {
        const samples = this.trainingManager.getSamples();

        let html = `
            <div style="margin-top: 25px; padding: 20px; background: rgba(0,0,0,0.1); border-radius: 10px;">
                <h4 style="margin: 0 0 15px 0; font-size: 1.2em;">🎯 最相似的训练样本（K=${neighbors.length}）</h4>
                <div class="similar-samples-grid" id="similarSamplesContainer">
        `;

        // 先创建占位符
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            const sample = samples[neighbor.index];
            const similarity = Math.max(0, 100 - neighbor.distance * 10).toFixed(1);
            const isMatch = sample.label === predictedLabel;

            html += `
                <div class="similar-sample-item ${isMatch ? 'match' : 'nomatch'}" style="animation-delay: ${i * 0.2}s;">
                    <div class="sample-rank">#${i + 1}</div>
                    <div style="margin: 15px 0;">
                        <canvas id="similarSampleCanvas${i}" width="100" height="100" style="border-radius: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"></canvas>
                    </div>
                    <div class="sample-emoji">${sample.label === 'smile' ? '😊' : '😢'}</div>
                    <div class="sample-similarity">
                        <div class="similarity-bar-container">
                            <div class="similarity-bar" style="width: ${similarity}%;"></div>
                        </div>
                        <div class="similarity-text">${similarity}% 相似</div>
                    </div>
                    <div class="sample-distance">距离: ${neighbor.distance.toFixed(2)}</div>
                    ${isMatch ? '<div class="match-badge">✓ 匹配</div>' : ''}
                </div>
            `;
        }

        html += `
                </div>
                <div style="margin-top: 15px; font-size: 0.9em; color: rgba(255,255,255,0.9); line-height: 1.6;">
                    💡 <strong>工作原理：</strong><br>
                    • 计算当前图像与每个训练样本的<strong>特征距离</strong>（${neighbors.length}个最近邻）<br>
                    • 距离越小 = 特征越相似 = 相似度越高<br>
                    • ${neighbors.filter(n => samples[n.index].label === predictedLabel).length} 个样本投票 "${predictedLabel === 'smile' ? '笑脸' : '哭脸'}"，所以最终结果是<strong>${predictedLabel === 'smile' ? '笑脸' : '哭脸'}</strong>！
                </div>
            </div>
        `;

        // 需要异步绘制图像
        setTimeout(() => {
            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];
                const sample = samples[neighbor.index];
                const canvas = document.getElementById(`similarSampleCanvas${i}`);

                if (canvas && sample.imageData) {
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(
                        (() => {
                            const temp = document.createElement('canvas');
                            temp.width = sample.imageData.width;
                            temp.height = sample.imageData.height;
                            const tempCtx = temp.getContext('2d');
                            tempCtx.putImageData(sample.imageData, 0, 0);
                            return temp;
                        })(),
                        0, 0, 100, 100
                    );
                } else if (canvas) {
                    // 如果没有imageData，显示占位符
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(0, 0, 100, 100);
                    ctx.fillStyle = '#999';
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('训练样本', 50, 45);
                    ctx.fillText(`#${neighbor.index + 1}`, 50, 65);
                }
            }
        }, 100);

        return html;
    }

    classify(originalMatrix, features) {
        const size = originalMatrix.length;

        // 优先使用训练好的KNN模型
        const trainingSamples = this.trainingManager.getSamples();
        if (trainingSamples.length >= 2) {
            // 至少有2个样本才使用KNN
            const featureVector = KNNClassifier.flattenFeatures(features);
            const prediction = this.classifier.predict(featureVector, trainingSamples);

            if (prediction) {
                const isSmile = prediction.label === 'smile';
                const emoji = isSmile ? '😊' : '😢';
                const labelText = isSmile ? '笑脸' : '哭脸';

                return {
                    emoji: emoji,
                    label: labelText,
                    confidence: prediction.confidence,
                    reason: `🎓 <strong>使用你训练的模型！</strong><br>` +
                            `计算机找到了 <strong>${prediction.neighbors.length} 个最相似的训练样本</strong>，` +
                            `其中 ${prediction.neighbors.filter(n => n.label === prediction.label).length} 个是${labelText}。<br>` +
                            `最相似样本的距离：${prediction.closestDistance.toFixed(2)}`,
                    usedTraining: true,
                    neighbors: prediction.neighbors  // 传递neighbors信息用于可视化
                };
            }
        }

        // 如果没有训练数据，使用原来的规则
        // 简化策略：主要使用横线探测器的特征分布
        // 笑脸：嘴巴区域的上部有横线（嘴角向上）
        // 哭脸：嘴巴区域的下部有横线（嘴角向下）

        const horizFeature = features.horizontal;
        const featSize = horizFeature.length;

        // 嘴巴在中部偏下位置（35%-65%）
        const mouthStartY = Math.floor(featSize * 0.35);
        const mouthEndY = Math.floor(featSize * 0.65);
        const mouthCenterY = Math.floor((mouthStartY + mouthEndY) / 2);

        // 计算嘴巴区域中心横向的特征强度
        const centerRegionX = Math.floor(featSize * 0.25);
        const centerRegionXEnd = Math.floor(featSize * 0.75);

        // 分析嘴巴中心线上下的特征
        let upperHalfStrength = 0;
        let lowerHalfStrength = 0;

        for (let y = mouthStartY; y < mouthEndY; y++) {
            for (let x = centerRegionX; x < centerRegionXEnd; x++) {
                const strength = horizFeature[y][x];
                if (y < mouthCenterY) {
                    upperHalfStrength += strength;
                } else {
                    lowerHalfStrength += strength;
                }
            }
        }

        // 计算原始图像中嘴巴区域的像素分布
        const imgMouthStartY = Math.floor(size * 0.35);
        const imgMouthEndY = Math.floor(size * 0.65);
        const imgMouthCenterY = Math.floor((imgMouthStartY + imgMouthEndY) / 2);
        const centerX = Math.floor(size / 2);

        let upperDarkPixels = 0;
        let lowerDarkPixels = 0;

        for (let y = imgMouthStartY; y < imgMouthEndY; y++) {
            for (let dx = -8; dx <= 8; dx++) {
                const x = centerX + dx;
                if (x >= 0 && x < size) {
                    const pixelValue = originalMatrix[y][x];
                    if (pixelValue < 0.5) {  // 深色像素
                        if (y < imgMouthCenterY) {
                            upperDarkPixels++;
                        } else {
                            lowerDarkPixels++;
                        }
                    }
                }
            }
        }

        // 调试信息
        console.log('分类特征:', {
            upperHalfStrength: upperHalfStrength.toFixed(2),
            lowerHalfStrength: lowerHalfStrength.toFixed(2),
            upperDarkPixels,
            lowerDarkPixels,
            ratio: (upperHalfStrength / (lowerHalfStrength + 0.001)).toFixed(2)
        });

        // 判断逻辑
        let isSmile = false;
        let confidence = 70;

        // 主要判据：横线特征的上下比例
        const featureRatio = upperHalfStrength / (lowerHalfStrength + 0.001);

        if (featureRatio > 1.3) {
            // 上方特征明显更强 → 笑脸
            isSmile = true;
            confidence = Math.min(95, 70 + (featureRatio - 1.3) * 30);
        } else if (featureRatio < 0.7) {
            // 下方特征明显更强 → 哭脸
            isSmile = false;
            confidence = Math.min(95, 70 + (1.3 - featureRatio) * 30);
        } else {
            // 特征不明显，使用原始像素分布
            if (upperDarkPixels > lowerDarkPixels * 1.2) {
                isSmile = true;
                confidence = 65;
            } else if (lowerDarkPixels > upperDarkPixels * 1.2) {
                isSmile = false;
                confidence = 65;
            } else {
                // 默认判断为笑脸（因为默认生成的是笑脸）
                isSmile = true;
                confidence = 60;
            }
        }

        if (isSmile) {
            return {
                emoji: '😊',
                label: '笑脸',
                confidence: Math.round(confidence),
                reason: `横线探测器在嘴巴<strong>上半部</strong>发现了较强的特征（上 ${upperHalfStrength.toFixed(1)} vs 下 ${lowerHalfStrength.toFixed(1)}），说明嘴角向上翘起。这是一个开心的表情！`
            };
        } else {
            return {
                emoji: '😢',
                label: '哭脸',
                confidence: Math.round(confidence),
                reason: `横线探测器在嘴巴<strong>下半部</strong>发现了较强的特征（下 ${lowerHalfStrength.toFixed(1)} vs 上 ${upperHalfStrength.toFixed(1)}），说明嘴角向下撇。这是一个悲伤的表情。`
            };
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 添加训练样本（在训练模式下使用）
    async addTrainingSample(label) {
        if (!this.lastPoolResults) {
            // 如果还没有处理过图像，先处理一次
            const imageData = this.drawingBoard.getImageData();
            const grayMatrix = ImageProcessor.toGrayscaleMatrix(imageData, 28);
            const convResults = {};

            for (let [name, kernel] of Object.entries(this.kernels)) {
                const convResult = ImageProcessor.convolve(grayMatrix, kernel);
                convResults[name] = ImageProcessor.normalize(convResult);
            }

            const poolResults = {};
            for (let [name, matrix] of Object.entries(convResults)) {
                poolResults[name] = ImageProcessor.maxPool(matrix, 2);
            }

            this.lastPoolResults = poolResults;
        }

        // 提取特征向量
        const features = KNNClassifier.flattenFeatures(this.lastPoolResults);

        // 获取当前画布的图像数据（用于显示缩略图）
        const imageData = this.drawingBoard.getImageData();

        // 添加到训练数据
        this.trainingManager.addSample(features, label, imageData);

        // 清空lastPoolResults，准备下一次
        this.lastPoolResults = null;

        return this.trainingManager.getStats();
    }

    // 获取训练统计
    getTrainingStats() {
        return this.trainingManager.getStats();
    }

    // 清空训练数据
    clearTrainingData() {
        this.trainingManager.clearAll();
    }

    // 获取所有训练样本
    getTrainingSamples() {
        return this.trainingManager.getSamples();
    }

    // 删除训练样本
    removeTrainingSample(index) {
        this.trainingManager.removeSample(index);
    }
}

// 主程序
document.addEventListener('DOMContentLoaded', () => {
    const drawingBoard = new DrawingBoard('drawingCanvas');
    const processor = new CNNProcessor(drawingBoard);

    let currentMode = 'recognition';  // 'recognition' 或 'training'

    // 更新训练样本显示
    function updateTrainingSamplesDisplay() {
        const samples = processor.getTrainingSamples();
        const samplesGrid = document.getElementById('samplesGrid');
        samplesGrid.innerHTML = '';

        samples.forEach((sample, index) => {
            const sampleDiv = document.createElement('div');
            sampleDiv.className = 'sample-item';

            const canvas = document.createElement('canvas');
            canvas.className = 'sample-canvas';
            canvas.width = 60;
            canvas.height = 60;

            // 如果有imageData，绘制缩略图
            if (sample.imageData) {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(
                    (() => {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = sample.imageData.width;
                        tempCanvas.height = sample.imageData.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.putImageData(sample.imageData, 0, 0);
                        return tempCanvas;
                    })(),
                    0, 0, 60, 60
                );
            } else {
                // 如果没有imageData（从localStorage加载的），显示占位符
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, 60, 60);
                ctx.fillStyle = '#999';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('训练', 30, 35);
            }

            const label = document.createElement('div');
            label.className = 'sample-label';
            label.textContent = sample.label === 'smile' ? '😊' : '😢';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'sample-delete';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => {
                processor.removeTrainingSample(index);
                updateTrainingSamplesDisplay();
                updateStats();
            };

            sampleDiv.appendChild(canvas);
            sampleDiv.appendChild(label);
            sampleDiv.appendChild(deleteBtn);
            samplesGrid.appendChild(sampleDiv);
        });

        // 显示或隐藏训练样本区域
        const trainingSamplesDiv = document.getElementById('trainingSamples');
        trainingSamplesDiv.style.display = samples.length > 0 ? 'block' : 'none';
    }

    // 更新统计信息
    function updateStats() {
        const stats = processor.getTrainingStats();
        document.getElementById('trainingCount').textContent = stats.total;
        document.getElementById('smileCount').textContent = stats.smileCount;
        document.getElementById('sadCount').textContent = stats.sadCount;
    }

    // 模式切换
    document.getElementById('recognitionMode').addEventListener('click', () => {
        currentMode = 'recognition';
        document.getElementById('recognitionMode').classList.add('active');
        document.getElementById('trainingMode').classList.remove('active');
        document.getElementById('trainingControls').style.display = 'none';
        document.getElementById('trainingTip').style.display = 'none';
        document.getElementById('drawingSectionTitle').textContent = '1️⃣ 画一个表情';
        document.getElementById('modeInfo').textContent = '💡 提示：可以用鼠标画，或者点击按钮生成表情';
    });

    document.getElementById('trainingMode').addEventListener('click', () => {
        currentMode = 'training';
        document.getElementById('trainingMode').classList.add('active');
        document.getElementById('recognitionMode').classList.remove('active');
        document.getElementById('trainingControls').style.display = 'block';
        document.getElementById('trainingTip').style.display = 'block';
        document.getElementById('drawingSectionTitle').textContent = '1️⃣ 画一个表情并标注';
        document.getElementById('modeInfo').textContent = '🎓 提示：画好后，点击下方按钮告诉计算机这是什么表情';
        updateStats();
        updateTrainingSamplesDisplay();
    });

    // 训练模式：标注为笑脸
    document.getElementById('labelSmile').addEventListener('click', async () => {
        const stats = await processor.addTrainingSample('smile');
        updateStats();
        updateTrainingSamplesDisplay();
        drawingBoard.clear();

        // 显示反馈
        alert(`✅ 笑脸样本已添加！\n总样本数：${stats.total}\n笑脸：${stats.smileCount} | 哭脸：${stats.sadCount}`);
    });

    // 训练模式：标注为哭脸
    document.getElementById('labelSad').addEventListener('click', async () => {
        const stats = await processor.addTrainingSample('sad');
        updateStats();
        updateTrainingSamplesDisplay();
        drawingBoard.clear();

        // 显示反馈
        alert(`✅ 哭脸样本已添加！\n总样本数：${stats.total}\n笑脸：${stats.smileCount} | 哭脸：${stats.sadCount}`);
    });

    // 清空训练数据
    document.getElementById('clearTrainingData').addEventListener('click', () => {
        if (confirm('确定要清空所有训练数据吗？')) {
            processor.clearTrainingData();
            updateStats();
            updateTrainingSamplesDisplay();
        }
    });

    // 生成笑脸
    document.getElementById('generateSmile').addEventListener('click', () => {
        drawingBoard.generateSmile();
    });

    // 生成哭脸
    document.getElementById('generateSad').addEventListener('click', () => {
        drawingBoard.generateSad();
    });

    // 生成简化笑脸
    document.getElementById('generateSimpleSmile').addEventListener('click', () => {
        drawingBoard.generateSimpleSmile();
    });

    // 生成简化哭脸
    document.getElementById('generateSimpleSad').addEventListener('click', () => {
        drawingBoard.generateSimpleSad();
    });

    // 清空画板
    document.getElementById('clearCanvas').addEventListener('click', () => {
        drawingBoard.clear();
    });

    // 开始处理
    document.getElementById('startProcess').addEventListener('click', async () => {
        document.getElementById('startProcess').style.display = 'none';
        document.getElementById('resetProcess').style.display = 'block';
        await processor.process();
    });

    // 重置
    document.getElementById('resetProcess').addEventListener('click', () => {
        document.getElementById('startProcess').style.display = 'block';
        document.getElementById('resetProcess').style.display = 'none';
        document.getElementById('stepsContainer').innerHTML = '';
        document.getElementById('finalResult').style.display = 'none';
    });

    // 初始化
    drawingBoard.generateSmile();
    updateStats();
    updateTrainingSamplesDisplay();
});
