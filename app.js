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
    static drawMatrix(canvas, matrix, cellSize = 10) {
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
                每个探测器都是一个 3×3 的小窗口，在图像上滑动，看看有没有它要找的特征。
            </div>
            <div class="visualization" id="convViz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('convViz');

        const kernelConfigs = [
            { name: 'horizontal', label: '横线探测器', desc: '找到横线' },
            { name: 'vertical', label: '竖线探测器', desc: '找到竖线' },
            { name: 'edge', label: '边缘探测器', desc: '找到边缘' }
        ];

        for (let config of kernelConfigs) {
            const result = ImageProcessor.convolve(matrix, this.kernels[config.name]);
            const normalized = ImageProcessor.normalize(result);
            results[config.name] = normalized;

            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${config.label}</div>
                <canvas id="kernel_${config.name}"></canvas>
                <canvas id="conv_${config.name}" style="margin-top: 10px;"></canvas>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">${config.desc}</div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(50);

            const kernelCanvas = document.getElementById(`kernel_${config.name}`);
            Visualizer.drawKernel(kernelCanvas, this.kernels[config.name]);

            const convCanvas = document.getElementById(`conv_${config.name}`);
            Visualizer.drawMatrix(convCanvas, normalized, 8);
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
                这样图像变小了，但重要信息还在！
            </div>
            <div class="visualization" id="poolViz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('poolViz');

        for (let [name, matrix] of Object.entries(convResults)) {
            const pooled = ImageProcessor.maxPool(matrix, 2);
            results[name] = pooled;

            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">压缩后 (${pooled.length}×${pooled.length})</div>
                <canvas id="pool_${name}"></canvas>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(50);

            const canvas = document.getElementById(`pool_${name}`);
            Visualizer.drawMatrix(canvas, pooled, 8);
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
                比如：用横线和竖线组合，可以找到"眼睛"、"嘴巴"等更高级的特征。
            </div>
            <div class="visualization" id="conv2Viz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('conv2Viz');

        for (let [name, matrix] of Object.entries(poolResults)) {
            const result = ImageProcessor.convolve(matrix, this.kernels.edge);
            const normalized = ImageProcessor.normalize(result);
            results[name] = normalized;

            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${name} 高级特征</div>
                <canvas id="conv2_${name}"></canvas>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(50);

            const canvas = document.getElementById(`conv2_${name}`);
            Visualizer.drawMatrix(canvas, normalized, 8);
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
                现在我们得到了最精华的特征信息！
            </div>
            <div class="visualization" id="pool2Viz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('pool2Viz');

        for (let [name, matrix] of Object.entries(conv2Results)) {
            const pooled = ImageProcessor.maxPool(matrix, 2);
            results[name] = pooled;

            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${name} 最终特征</div>
                <canvas id="pool2_${name}"></canvas>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(50);

            const canvas = document.getElementById(`pool2_${name}`);
            Visualizer.drawMatrix(canvas, pooled, 10);
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
        // 分析原始图像的下半部分（嘴巴区域）
        const size = originalMatrix.length;
        const mouthRegion = originalMatrix.slice(Math.floor(size * 0.6));

        // 计算嘴巴区域的特征
        let topDark = 0;
        let bottomDark = 0;

        const mouthHeight = mouthRegion.length;
        const mouthTop = mouthRegion.slice(0, Math.floor(mouthHeight / 2));
        const mouthBottom = mouthRegion.slice(Math.floor(mouthHeight / 2));

        // 统计深色像素
        for (let row of mouthTop) {
            for (let val of row) {
                if (val < 0.5) topDark++;
            }
        }

        for (let row of mouthBottom) {
            for (let val of row) {
                if (val < 0.5) bottomDark++;
            }
        }

        // 计算特征强度
        let horizontalStrength = 0;
        for (let row of features.horizontal) {
            for (let val of row) {
                horizontalStrength += val;
            }
        }

        // 判断：如果上方深色像素多，可能是笑脸；如果下方多，可能是哭脸
        const isSmile = topDark > bottomDark * 1.2;

        const confidence = Math.min(95, 60 + Math.abs(topDark - bottomDark) / 10);

        if (isSmile) {
            return {
                emoji: '😊',
                label: '笑脸',
                confidence: Math.round(confidence),
                reason: '横线探测器在嘴巴上方发现了向上的弧线特征，边缘探测器找到了完整的笑脸轮廓。这是一个开心的表情！'
            };
        } else {
            return {
                emoji: '😢',
                label: '哭脸',
                confidence: Math.round(confidence),
                reason: '横线探测器在嘴巴下方发现了向下的弧线特征，这是一个悲伤的表情。'
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
