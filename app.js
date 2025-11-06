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

    getImageData() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}

// 图像处理类
class ImageProcessor {
    // 将图像数据转换为灰度矩阵
    static toGrayscaleMatrix(imageData, targetSize = 28) {
        const { width, height, data } = imageData;
        const matrix = [];

        // 缩放比例
        const scaleX = width / targetSize;
        const scaleY = height / targetSize;

        for (let y = 0; y < targetSize; y++) {
            const row = [];
            for (let x = 0; x < targetSize; x++) {
                // 采样原图像中对应的像素
                const srcX = Math.floor(x * scaleX);
                const srcY = Math.floor(y * scaleY);
                const idx = (srcY * width + srcX) * 4;

                // 转换为灰度值 (0-255)
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                // 归一化到 0-1
                row.push(gray / 255);
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
    static async animatePooling(inputCanvas, outputCanvas, matrix, poolSize, cellSize = 8, speed = 100, useHeatmap = false) {
        const inputSize = matrix.length;
        const outputSize = Math.floor(inputSize / poolSize);
        const outputMatrix = Array(outputSize).fill(0).map(() => Array(outputSize).fill(0));

        const outCtx = outputCanvas.getContext('2d');
        outputCanvas.width = outputSize * cellSize;
        outputCanvas.height = outputSize * cellSize;

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
                    Visualizer.drawHeatmap(inputCanvas, matrix, cellSize, {
                        x: x * poolSize,
                        y: y * poolSize,
                        size: poolSize
                    });
                } else {
                    Visualizer.drawMatrix(inputCanvas, matrix, cellSize, {
                        x: x * poolSize,
                        y: y * poolSize,
                        size: poolSize
                    });
                }

                // 更新输出矩阵
                Visualizer.drawPartialMatrix(outputCanvas, outputMatrix, cellSize, x, y, useHeatmap);

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

        // 步骤3：池化 - 信息压缩
        const poolResults = await this.showStep3(convResults);
        await this.delay(1500);

        // 步骤4：第二次卷积
        const conv2Results = await this.showStep4(poolResults);
        await this.delay(1500);

        // 步骤5：第二次池化
        const pool2Results = await this.showStep5(conv2Results);
        await this.delay(1500);

        // 步骤6：分类判断
        await this.showStep6(grayMatrix, pool2Results);
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
                👀 <strong>红色方框标出了当前正在压缩的 2×2 区域！</strong>
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
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">压缩前</div>
                        <canvas id="poolInput_${name}"></canvas>
                    </div>
                    <div class="arrow">→</div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">压缩后</div>
                        <canvas id="poolOutput_${name}"></canvas>
                    </div>
                </div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(100);

            // 执行动画池化
            const inputCanvas = document.getElementById(`poolInput_${name}`);
            const outputCanvas = document.getElementById(`poolOutput_${name}`);
            const pooled = await Visualizer.animatePooling(
                inputCanvas,
                outputCanvas,
                matrix,
                2,  // 池化大小
                8,  // 单元格大小
                30  // 速度：30ms 每步
            );

            results[name] = pooled;
        }

        return results;
    }

    async showStep4(poolResults) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>🔍 步骤 4：更高级的特征探测</h3>
            <div class="step-description">
                第一次找到了线条，现在要组合这些线条，找更复杂的图案！<br>
                比如：用横线和竖线组合，可以找到"眼睛"、"嘴巴"等更高级的特征。<br>
                🌈 <strong>用彩色热力图显示特征强度：红色=强特征，蓝色=弱特征</strong>
            </div>
            <div class="visualization" id="conv2Viz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('conv2Viz');

        for (let [name, matrix] of Object.entries(poolResults)) {
            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${name} 高级特征提取</div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">再次扫描（热力图）</div>
                        <canvas id="conv2Input_${name}"></canvas>
                    </div>
                    <div class="arrow">→</div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">高级特征（热力图）</div>
                        <canvas id="conv2Output_${name}"></canvas>
                    </div>
                </div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(100);

            // 执行热力图动画卷积（单元格更大，看得更清楚）
            const inputCanvas = document.getElementById(`conv2Input_${name}`);
            const outputCanvas = document.getElementById(`conv2Output_${name}`);
            const result = await Visualizer.animateConvolutionHeatmap(
                inputCanvas,
                outputCanvas,
                matrix,
                this.kernels.edge,
                15,  // 更大的单元格
                30  // 速度稍快一些
            );

            results[name] = result;
        }

        return results;
    }

    async showStep5(conv2Results) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>📦 步骤 5：再次压缩</h3>
            <div class="step-description">
                再次使用"取最强信号"的方法，把图像压缩得更小。<br>
                现在我们得到了最精华的特征信息！<br>
                🌈 <strong>最后一次压缩，提取最重要的信息！热力图让特征更清晰！</strong>
            </div>
            <div class="visualization" id="pool2Viz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('pool2Viz');

        for (let [name, matrix] of Object.entries(conv2Results)) {
            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${name} 最终压缩</div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">压缩前（热力图）</div>
                        <canvas id="pool2Input_${name}"></canvas>
                    </div>
                    <div class="arrow">→</div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">最终特征（热力图）</div>
                        <canvas id="pool2Output_${name}"></canvas>
                    </div>
                </div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(100);

            // 执行动画池化（使用热力图）
            const inputCanvas = document.getElementById(`pool2Input_${name}`);
            const outputCanvas = document.getElementById(`pool2Output_${name}`);
            const pooled = await Visualizer.animatePooling(
                inputCanvas,
                outputCanvas,
                matrix,
                2,  // 池化大小
                18,  // 单元格更大
                40,  // 速度稍快
                true // 使用热力图
            );

            results[name] = pooled;
        }

        return results;
    }

    async showStep6(originalMatrix, finalFeatures) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>🎯 步骤 6：最终判断</h3>
            <div class="step-description">
                现在把所有提取的特征综合起来判断：这是什么表情？<br>
                计算机会根据它"学过"的规律来做判断：<br>
                • 如果嘴巴的位置有<strong>向上的弧线</strong>（横线探测器在下方找到特征） → 可能是笑脸 😊<br>
                • 如果嘴巴的位置有<strong>向下的弧线</strong> → 可能是哭脸 😢
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(500);

        // 简单的分类逻辑：检测下半部分的特征
        const result = this.classify(originalMatrix, finalFeatures);

        this.finalResult.style.display = 'block';
        this.resultContent.innerHTML = `
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
    }

    classify(originalMatrix, features) {
        const size = originalMatrix.length;

        // 分析策略：
        // 1. 分析原始图像的嘴巴区域形状
        // 2. 使用横线探测器的特征分布
        // 3. 综合判断

        // === 策略1: 分析嘴巴区域的曲率 ===
        // 嘴巴在脸的下半部分（60%-90%的位置）
        const mouthStartY = Math.floor(size * 0.55);
        const mouthEndY = Math.floor(size * 0.85);
        const centerX = Math.floor(size / 2);

        // 分析嘴巴的上弧和下弧
        let upperArcDarkness = 0;  // 嘴巴上弧的深色像素
        let lowerArcDarkness = 0;  // 嘴巴下弧的深色像素

        for (let y = mouthStartY; y < mouthEndY; y++) {
            const relativeY = (y - mouthStartY) / (mouthEndY - mouthStartY);
            // 采样中间区域（嘴巴位置）
            for (let dx = -6; dx <= 6; dx++) {
                const x = centerX + dx;
                if (x >= 0 && x < size) {
                    const pixelValue = originalMatrix[y][x];
                    if (pixelValue < 0.5) {  // 深色像素
                        if (relativeY < 0.5) {
                            upperArcDarkness++;
                        } else {
                            lowerArcDarkness++;
                        }
                    }
                }
            }
        }

        // === 策略2: 使用横线探测器的特征分布 ===
        const horizFeature = features.horizontal;
        const featSize = horizFeature.length;

        // 分析横线特征的上下分布
        let upperFeatureStrength = 0;
        let lowerFeatureStrength = 0;

        // 嘴巴对应的特征图区域（大约在下半部）
        const featureMouthStart = Math.floor(featSize * 0.55);
        const featureMouthEnd = Math.floor(featSize * 0.85);

        for (let y = featureMouthStart; y < Math.min(featureMouthEnd, featSize); y++) {
            const relativeY = (y - featureMouthStart) / (featureMouthEnd - featureMouthStart);
            for (let x = 0; x < featSize; x++) {
                const strength = horizFeature[y][x];
                if (relativeY < 0.5) {
                    upperFeatureStrength += strength;
                } else {
                    lowerFeatureStrength += strength;
                }
            }
        }

        // === 策略3: 分析边缘特征的分布 ===
        const edgeFeature = features.edge;
        let mouthEdgeStrength = 0;

        for (let y = featureMouthStart; y < Math.min(featureMouthEnd, featSize); y++) {
            for (let x = Math.floor(featSize * 0.3); x < Math.floor(featSize * 0.7); x++) {
                mouthEdgeStrength += edgeFeature[y][x];
            }
        }

        // === 综合判断 ===
        let smileScore = 0;
        let sadScore = 0;

        // 判据1: 原始图像中，笑脸的嘴巴上弧有更多线条
        if (upperArcDarkness > lowerArcDarkness * 1.1) {
            smileScore += 2;
        } else if (lowerArcDarkness > upperArcDarkness * 1.1) {
            sadScore += 2;
        }

        // 判据2: 横线探测器，笑脸在上方有更强的横线
        if (upperFeatureStrength > lowerFeatureStrength * 0.8) {
            smileScore += 3;
        } else {
            sadScore += 3;
        }

        // 判据3: 总的深色像素分布
        const totalDark = upperArcDarkness + lowerArcDarkness;
        if (totalDark > 10) {  // 有明显的嘴巴
            const upperRatio = upperArcDarkness / totalDark;
            if (upperRatio > 0.55) {
                smileScore += 2;
            } else if (upperRatio < 0.45) {
                sadScore += 2;
            }
        }

        // 判据4: 边缘强度（嘴巴越明显，置信度越高）
        const edgeBonus = Math.min(2, mouthEdgeStrength / 10);

        const isSmile = smileScore >= sadScore;
        const scoreDiff = Math.abs(smileScore - sadScore);
        const confidence = Math.min(95, 50 + scoreDiff * 8 + edgeBonus * 5);

        // 调试信息
        console.log('分类特征:', {
            upperArcDarkness,
            lowerArcDarkness,
            upperFeatureStrength: upperFeatureStrength.toFixed(2),
            lowerFeatureStrength: lowerFeatureStrength.toFixed(2),
            smileScore,
            sadScore,
            confidence
        });

        if (isSmile) {
            return {
                emoji: '😊',
                label: '笑脸',
                confidence: Math.round(confidence),
                reason: `横线探测器在嘴巴<strong>上方</strong>发现了较强的特征（${upperFeatureStrength.toFixed(1)} > ${lowerFeatureStrength.toFixed(1)}），说明嘴巴向上弯曲。边缘探测器找到了完整的笑脸轮廓。这是一个开心的表情！`
            };
        } else {
            return {
                emoji: '😢',
                label: '哭脸',
                confidence: Math.round(confidence),
                reason: `横线探测器在嘴巴<strong>下方</strong>发现了较强的特征（下方 ${lowerFeatureStrength.toFixed(1)} > 上方 ${upperFeatureStrength.toFixed(1)}），说明嘴巴向下弯曲。这是一个悲伤的表情。`
            };
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 主程序
document.addEventListener('DOMContentLoaded', () => {
    const drawingBoard = new DrawingBoard('drawingCanvas');
    const processor = new CNNProcessor(drawingBoard);

    // 生成笑脸
    document.getElementById('generateSmile').addEventListener('click', () => {
        drawingBoard.generateSmile();
    });

    // 生成哭脸
    document.getElementById('generateSad').addEventListener('click', () => {
        drawingBoard.generateSad();
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

    // 默认生成一个笑脸
    drawingBoard.generateSmile();
});
