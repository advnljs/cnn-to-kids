// Debug模式检测
const DEBUG_MODE = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === 'true';
})();

if (DEBUG_MODE) {
    console.log('🐛 Debug模式已启用 - 将跳过动画直接显示结果');
}

// Debug模式下的轻量级Loading指示器（防“假死”感）
const DebugLoading = (() => {
    let ensured = false;
    let overlayEl = null;

    function ensureUI() {
        if (ensured || !DEBUG_MODE) return;
        ensured = true;

        // 注入样式（仅Debug模式）
        const styleId = 'debugLoadingStyles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
            @keyframes debug-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .debug-loading-card {
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(102, 126, 234, 0.95);
                color: #fff;
                padding: 8px 14px;
                border-radius: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                font-size: 13px;
                font-weight: 600;
            }
            .debug-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255,255,255,0.6);
                border-top-color: #fff;
                border-radius: 50%;
                animation: debug-spin 0.8s linear infinite;
            }
            `;
            document.head.appendChild(style);
        }

        // 创建悬浮指示器
        overlayEl = document.createElement('div');
        overlayEl.id = 'debugLoadingOverlay';
        overlayEl.style.position = 'fixed';
        overlayEl.style.top = '50px'; // 避开右上角“Debug模式”徽标
        overlayEl.style.right = '10px';
        overlayEl.style.zIndex = '99999';
        overlayEl.style.display = 'none';
        overlayEl.style.pointerEvents = 'none'; // 不阻断交互

        overlayEl.innerHTML = `
            <div class="debug-loading-card">
                <div class="debug-spinner"></div>
                <div class="debug-text">快速计算中...</div>
            </div>
        `;

        document.body.appendChild(overlayEl);
    }

    function show(message) {
        if (!DEBUG_MODE) return;
        if (!ensured) ensureUI();
        const textEl = overlayEl?.querySelector('.debug-text');
        if (textEl && typeof message === 'string' && message.length > 0) {
            textEl.textContent = message;
        }
        if (overlayEl) overlayEl.style.display = 'block';
    }

    function hide() {
        if (!DEBUG_MODE) return;
        if (overlayEl) overlayEl.style.display = 'none';
    }

    return { ensureUI, show, hide };
})();

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
        const catCount = this.samples.filter(s => s.label === 'cat').length;
        const flowerCount = this.samples.filter(s => s.label === 'flower').length;
        return {
            total: this.samples.length,
            catCount,
            flowerCount
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

                    // 从base64还原imageData（同步方式 - 使用临时canvas）
                    if (s.imageDataURL) {
                        try {
                            // 创建临时image和canvas来解码base64
                            const img = new Image();
                            const canvas = document.createElement('canvas');
                            canvas.width = 280;
                            canvas.height = 280;
                            const ctx = canvas.getContext('2d');

                            // Data URL是同步的，可以立即使用
                            // 但需要先加载完成
                            img.onload = () => {
                                ctx.drawImage(img, 0, 0, 280, 280);
                            };
                            img.src = s.imageDataURL;

                            // 对于data URL，浏览器会同步解码
                            // 但我们需要确保onload执行完成
                            // 使用另一种方法：直接从base64解码

                            // 更好的方法：存储为ImageData的原始数据
                            // 暂时保存URL，稍后异步加载
                            imageData = s.imageDataURL;  // 临时存储URL
                        } catch (err) {
                            console.warn('还原imageData失败:', err);
                        }
                    }

                    return {
                        features: s.features,
                        label: s.label,
                        imageData: imageData,  // 现在是URL字符串，稍后转换
                        imageDataURL: s.imageDataURL,  // 保留原始URL
                        timestamp: Date.now()
                    };
                });

                // 异步加载所有图像
                this.loadImagesAsync();
            }
        } catch (e) {
            console.warn('无法从localStorage加载训练数据:', e);
        }
    }

    // 异步加载所有图像
    async loadImagesAsync() {
        const promises = this.samples.map((sample, index) => {
            return new Promise((resolve) => {
                if (sample.imageDataURL && typeof sample.imageData === 'string') {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 280;
                        canvas.height = 280;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, 280, 280);
                        this.samples[index].imageData = ctx.getImageData(0, 0, 280, 280);
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`图像加载失败: 样本 ${index}`);
                        this.samples[index].imageData = null;
                        resolve();
                    };
                    img.src = sample.imageDataURL;
                } else {
                    resolve();
                }
            });
        });

        await Promise.all(promises);

        // 触发UI更新事件
        const event = new CustomEvent('trainingDataLoaded');
        window.dispatchEvent(event);
    }
}

// KNN分类器
class KNNClassifier {
    constructor(k = 3) {
        this.k = k;  // K近邻的K值
    }

    // 将距离映射为 0-100 的相似度（用于展示）
    // 说明：我们用“最大可能距离”做归一化，让数值更直观、跨样本更稳定。
    // 加权距离的最大值（特征都在0-1时）约为 sqrt(75*1 + 9*10)。
    static maxWeightedDistance() {
        const spatialDims = 75;
        const discriminativeDims = 9;
        const spatialWeight = 1.0;
        const discriminativeWeight = 10.0;
        return Math.sqrt(spatialDims * spatialWeight + discriminativeDims * discriminativeWeight);
    }

    static distanceToSimilarity(distance, maxDistance = KNNClassifier.maxWeightedDistance()) {
        if (!isFinite(distance)) return 0;
        // 数值极小的距离当作完全相同，避免浮点误差导致“不是100%”
        if (Math.abs(distance) < 1e-9) return 100;
        const sim = (1 - (distance / (maxDistance + 1e-12))) * 100;
        return Math.max(0, Math.min(100, sim));
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

    // 加权距离计算：给判别特征更高的权重
    static weightedDistance(features1, features2) {
        // 84维特征：前75维是降采样特征，后9维是判别特征
        const spatialDims = 75;
        const discriminativeDims = 9;

        // 权重：判别特征的权重设为空间特征的10倍
        const spatialWeight = 1.0;
        const discriminativeWeight = 10.0;

        let sum = 0;

        // 前75维：空间特征（权重1.0）
        for (let i = 0; i < spatialDims; i++) {
            const diff = features1[i] - features2[i];
            sum += spatialWeight * diff * diff;
        }

        // 后9维：判别特征（权重10.0）
        for (let i = spatialDims; i < spatialDims + discriminativeDims; i++) {
            const diff = features1[i] - features2[i];
            sum += discriminativeWeight * diff * diff;
        }

        return Math.sqrt(sum);
    }

    // 将矩阵展平为特征向量（旧方法，507维，位置相关）
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

    // 使用全局池化提取位置不变特征（新方法，6维，位置无关）
    static extractGlobalFeatures(poolResults) {
        const features = [];
        // 对每个特征图进行全局平均池化和全局最大池化
        for (let name of ['horizontal', 'vertical', 'edge']) {
            const matrix = poolResults[name];
            features.push(ImageProcessor.globalAveragePool(matrix));  // 平均值
            features.push(ImageProcessor.globalMaxPool(matrix));      // 最大值
        }
        // 返回6维特征: [h_avg, h_max, v_avg, v_max, e_avg, e_max]
        return features;
    }

    // 混合特征提取：降采样 + 关键区域对比
    static extractRegionalFeatures(poolResults) {
        const features = [];

        // 第一部分：降采样特征（保留空间信息）
        for (let name of ['horizontal', 'vertical', 'edge']) {
            const matrix = poolResults[name];
            const size = matrix.length; // 13

            // 降采样到 5×5
            const downSize = 5;
            const step = Math.floor(size / downSize);

            for (let y = 0; y < downSize; y++) {
                for (let x = 0; x < downSize; x++) {
                    const srcY = Math.min(y * step + Math.floor(step / 2), size - 1);
                    const srcX = Math.min(x * step + Math.floor(step / 2), size - 1);
                    features.push(matrix[srcY][srcX]);
                }
            }
        }

        // 第二部分：关键判别特征（专门区分笑脸/哭脸）
        const horizontal = poolResults['horizontal'];
        const size = horizontal.length;

        // 将图像分成上、中、下三个区域
        const topThird = Math.floor(size / 3);
        const bottomThird = Math.floor(size * 2 / 3);

        // 提取上半部分的横线特征（笑脸嘴巴上翘）
        let topSum = 0, topCount = 0, topMax = -Infinity;
        for (let y = 0; y < topThird; y++) {
            for (let x = 0; x < size; x++) {
                const val = horizontal[y][x];
                topSum += val;
                topCount++;
                topMax = Math.max(topMax, val);
            }
        }
        const topAvg = topCount > 0 ? topSum / topCount : 0;
        if (topMax === -Infinity) topMax = 0;

        // 提取中间部分的横线特征
        let midSum = 0, midCount = 0, midMax = -Infinity;
        for (let y = topThird; y < bottomThird; y++) {
            for (let x = 0; x < size; x++) {
                const val = horizontal[y][x];
                midSum += val;
                midCount++;
                midMax = Math.max(midMax, val);
            }
        }
        const midAvg = midCount > 0 ? midSum / midCount : 0;
        if (midMax === -Infinity) midMax = 0;

        // 提取下半部分的横线特征（哭脸嘴巴下翘）
        let bottomSum = 0, bottomCount = 0, bottomMax = -Infinity;
        for (let y = bottomThird; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const val = horizontal[y][x];
                bottomSum += val;
                bottomCount++;
                bottomMax = Math.max(bottomMax, val);
            }
        }
        const bottomAvg = bottomCount > 0 ? bottomSum / bottomCount : 0;
        if (bottomMax === -Infinity) bottomMax = 0;

        // 添加判别特征
        features.push(topAvg);      // 上部平均值
        features.push(topMax);      // 上部最大值
        features.push(midAvg);      // 中部平均值
        features.push(midMax);      // 中部最大值
        features.push(bottomAvg);   // 下部平均值
        features.push(bottomMax);   // 下部最大值

        // 添加对比特征（最关键！）
        features.push(topAvg - bottomAvg);        // 上下差异（笑脸为正，哭脸为负）
        features.push(topMax - bottomMax);        // 上下最大值差异
        features.push((topAvg + topMax) - (bottomAvg + bottomMax));  // 综合差异

        // 3个特征图 × 5×5 = 75维
        // + 判别特征 9维
        // = 84维总特征
        return features;
    }

    // 预测（使用加权距离）
    predict(features, trainingSamples) {
        if (trainingSamples.length === 0) {
            return null;
        }

        // 计算与所有训练样本的距离（使用加权距离）
        const distances = trainingSamples.map((sample, index) => ({
            index,
            label: sample.label,
            distance: KNNClassifier.weightedDistance(features, sample.features)
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

        // 强领先机制：如果第一近邻明显优于第二近邻，则直接采纳第一近邻结果
        // 判定依据（任一满足即可）：
        // 1) 距离比率阈值：d1 / d0 >= 1.8
        // 2) 相似度差距阈值：((d1 - d0) * 10) >= 20  —— 与可视化中 100 - d*10 的映射一致
        const d0 = neighbors[0]?.distance ?? Infinity;
        const d1 = neighbors[1]?.distance ?? Infinity;
        const ratioThreshold = 1.8;
        const similarityMarginThreshold = 20; // 百分点
        const ratio1 = isFinite(d0) ? (d1 / (d0 + 1e-9)) : 1;
        const similarityMargin = (d1 - d0) * 10; // 约等于 sim0 - sim1

        let predictedLabel = null;
        let confidence = 0;

        if (isFinite(d0) && isFinite(d1) && (ratio1 >= ratioThreshold || similarityMargin >= similarityMarginThreshold)) {
            // 直接采用第一近邻
            predictedLabel = neighbors[0].label;
            // 置信度基于第一近邻的相似度映射（与可视化一致），并给出最低保底
            const topSimilarity = Math.max(0, Math.min(99, Math.round(100 - d0 * 10)));
            confidence = Math.max(85, topSimilarity);
        } else {
            // 常规KNN投票
            let maxCount = 0;
            for (let label in labelCounts) {
                if (labelCounts[label] > maxCount) {
                    maxCount = labelCounts[label];
                    predictedLabel = label;
                }
            }
            confidence = Math.round((maxCount / k) * 100);
        }

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

    generateCat() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 画脸轮廓（圆形）
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        this.ctx.stroke();

        // 画左耳（三角形）
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 60, centerY - 50);
        this.ctx.lineTo(centerX - 40, centerY - 100);
        this.ctx.lineTo(centerX - 20, centerY - 50);
        this.ctx.stroke();

        // 画右耳（三角形）
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + 20, centerY - 50);
        this.ctx.lineTo(centerX + 40, centerY - 100);
        this.ctx.lineTo(centerX + 60, centerY - 50);
        this.ctx.stroke();

        // 画左眼
        this.ctx.beginPath();
        this.ctx.arc(centerX - 30, centerY - 20, 10, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        // 画右眼
        this.ctx.beginPath();
        this.ctx.arc(centerX + 30, centerY - 20, 10, 0, Math.PI * 2);
        this.ctx.fill();

        // 画鼻子（小三角形）
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 8, centerY + 10);
        this.ctx.lineTo(centerX, centerY);
        this.ctx.lineTo(centerX + 8, centerY + 10);
        this.ctx.closePath();
        this.ctx.fill();

        // 画嘴巴（两条弧线）
        this.ctx.strokeStyle = 'black';
        this.ctx.beginPath();
        this.ctx.arc(centerX - 15, centerY + 20, 20, 0, 0.5 * Math.PI);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(centerX + 15, centerY + 20, 20, 0.5 * Math.PI, Math.PI);
        this.ctx.stroke();

        // 画胡须（左侧）
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 80, centerY);
        this.ctx.lineTo(centerX - 40, centerY - 5);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 80, centerY + 10);
        this.ctx.lineTo(centerX - 40, centerY + 10);
        this.ctx.stroke();

        // 画胡须（右侧）
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + 40, centerY - 5);
        this.ctx.lineTo(centerX + 80, centerY);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + 40, centerY + 10);
        this.ctx.lineTo(centerX + 80, centerY + 10);
        this.ctx.stroke();
    }

    generateFlower() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2 - 30;

        // 画花蕊（中心圆）
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
        this.ctx.stroke();

        // 画5片花瓣（椭圆）
        const petalCount = 5;
        const petalRadius = 35;
        const petalDistance = 45;

        for (let i = 0; i < petalCount; i++) {
            const angle = (i * 2 * Math.PI) / petalCount - Math.PI / 2;
            const petalX = centerX + Math.cos(angle) * petalDistance;
            const petalY = centerY + Math.sin(angle) * petalDistance;

            this.ctx.save();
            this.ctx.translate(petalX, petalY);
            this.ctx.rotate(angle);
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, petalRadius, petalRadius * 0.6, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 画花茎（直线）
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY + 20);
        this.ctx.lineTo(centerX, centerY + 120);
        this.ctx.stroke();

        // 画叶子（左侧）
        this.ctx.beginPath();
        this.ctx.ellipse(centerX - 25, centerY + 60, 20, 12, -0.5, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 6;
        this.ctx.stroke();

        // 画叶子（右侧）
        this.ctx.beginPath();
        this.ctx.ellipse(centerX + 25, centerY + 80, 20, 12, 0.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    // 生成简化猫（只有耳朵和脸）
    generateSimpleCat() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 画左耳（三角形）
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 60, centerY - 30);
        this.ctx.lineTo(centerX - 40, centerY - 80);
        this.ctx.lineTo(centerX - 20, centerY - 30);
        this.ctx.stroke();

        // 画右耳（三角形）
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + 20, centerY - 30);
        this.ctx.lineTo(centerX + 40, centerY - 80);
        this.ctx.lineTo(centerX + 60, centerY - 30);
        this.ctx.stroke();

        // 画左眼
        this.ctx.beginPath();
        this.ctx.arc(centerX - 25, centerY, 10, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        // 画右眼
        this.ctx.beginPath();
        this.ctx.arc(centerX + 25, centerY, 10, 0, Math.PI * 2);
        this.ctx.fill();

        // 画简单的嘴巴（W形状）
        this.ctx.strokeStyle = 'black';
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 20, centerY + 30);
        this.ctx.lineTo(centerX - 10, centerY + 40);
        this.ctx.lineTo(centerX, centerY + 35);
        this.ctx.lineTo(centerX + 10, centerY + 40);
        this.ctx.lineTo(centerX + 20, centerY + 30);
        this.ctx.stroke();
    }

    // 生成简化花（只有花瓣和花茎）
    generateSimpleFlower() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2 - 20;

        // 画花蕊（小圆点）
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        // 画4片花瓣（简单圆形）
        const petalPositions = [
            { x: -40, y: 0 },   // 左
            { x: 40, y: 0 },    // 右
            { x: 0, y: -40 },   // 上
            { x: 0, y: 40 }     // 下
        ];

        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 6;
        petalPositions.forEach(pos => {
            this.ctx.beginPath();
            this.ctx.arc(centerX + pos.x, centerY + pos.y, 25, 0, Math.PI * 2);
            this.ctx.stroke();
        });

        // 画花茎（直线）
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY + 40);
        this.ctx.lineTo(centerX, centerY + 110);
        this.ctx.stroke();
    }

    getImageData() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
}

// 图像处理类
class ImageProcessor {
    // 预处理：检测内容边界框
    static detectBoundingBox(imageData) {
        const { width, height, data } = imageData;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let hasContent = false;

        // 扫描所有像素，找到非白色像素的边界
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // 判断是否为非白色像素（阈值240，允许一些浅灰色）
                if (r < 240 || g < 240 || b < 240) {
                    hasContent = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (!hasContent) {
            // 如果没有内容，返回整个画布
            return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, width, height };
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    // 预处理：裁剪、居中、尺度归一化
    static preprocessImage(imageData, targetSize = 280) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = targetSize;
        canvas.height = targetSize;

        // 绘制白色背景
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, targetSize, targetSize);

        // 检测边界框
        const bbox = ImageProcessor.detectBoundingBox(imageData);

        if (bbox.width === 0 || bbox.height === 0) {
            // 空图像，返回白色画布
            return ctx.getImageData(0, 0, targetSize, targetSize);
        }

        // 创建临时画布，绘制原始图像
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // 计算缩放比例，保持宽高比
        const padding = 20; // 添加padding，避免贴边
        const maxContentSize = targetSize - padding * 2;
        const scale = Math.min(
            maxContentSize / bbox.width,
            maxContentSize / bbox.height
        );

        // 计算缩放后的尺寸
        const scaledWidth = bbox.width * scale;
        const scaledHeight = bbox.height * scale;

        // 计算居中位置
        const offsetX = (targetSize - scaledWidth) / 2;
        const offsetY = (targetSize - scaledHeight) / 2;

        // 绘制到目标画布（裁剪+缩放+居中）
        ctx.drawImage(
            tempCanvas,
            bbox.minX, bbox.minY, bbox.width, bbox.height,  // 源区域（裁剪）
            offsetX, offsetY, scaledWidth, scaledHeight      // 目标区域（缩放+居中）
        );

        return ctx.getImageData(0, 0, targetSize, targetSize);
    }

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

    // 全局平均池化（提取位置不变特征）
    static globalAveragePool(matrix) {
        let sum = 0;
        let count = 0;

        for (let row of matrix) {
            for (let val of row) {
                sum += val;
                count++;
            }
        }

        return count > 0 ? sum / count : 0;
    }

    // 全局最大池化（提取位置不变特征）
    static globalMaxPool(matrix) {
        let max = -Infinity;

        for (let row of matrix) {
            for (let val of row) {
                max = Math.max(max, val);
            }
        }

        return max;
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
        // Debug模式：跳过逐格动画，直接计算并绘制最终结果（防止主线程长时间占用）
        if (DEBUG_MODE) {
            const conv = ImageProcessor.convolve(matrix, kernel);
            const outputMatrix = ImageProcessor.normalize(conv);
            // 绘制输入与最终输出
            Visualizer.drawMatrix(inputCanvas, matrix, cellSize);
            Visualizer.drawMatrix(outputCanvas, outputMatrix, cellSize);
            return outputMatrix;
        }

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

                // 延迟，创建动画效果（Debug模式下跳过）
                if (!DEBUG_MODE) {
                    await new Promise(resolve => setTimeout(resolve, speed));
                }
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
        // Debug模式：直接计算并一次性绘制热力图
        if (DEBUG_MODE) {
            const conv = ImageProcessor.convolve(matrix, kernel);
            const outputMatrix = ImageProcessor.normalize(conv);
            Visualizer.drawHeatmap(inputCanvas, matrix, cellSize);
            Visualizer.drawHeatmap(outputCanvas, outputMatrix, cellSize);
            return outputMatrix;
        }

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

                // 延迟，创建动画效果（Debug模式下跳过）
                if (!DEBUG_MODE) {
                    await new Promise(resolve => setTimeout(resolve, speed));
                }
            }
        }

        // 返回归一化的输出矩阵
        return ImageProcessor.normalize(outputMatrix);
    }

    // 动画展示池化过程
    static async animatePooling(inputCanvas, outputCanvas, matrix, poolSize, inputCellSize = 8, outputCellSize = 8, speed = 100, useHeatmap = false) {
        // Debug模式：直接池化并绘制最终结果
        if (DEBUG_MODE) {
            const outputMatrix = ImageProcessor.maxPool(matrix, poolSize);
            if (useHeatmap) {
                Visualizer.drawHeatmap(inputCanvas, matrix, inputCellSize);
                Visualizer.drawHeatmap(outputCanvas, outputMatrix, outputCellSize);
            } else {
                Visualizer.drawMatrix(inputCanvas, matrix, inputCellSize);
                Visualizer.drawMatrix(outputCanvas, outputMatrix, outputCellSize);
            }
            return outputMatrix;
        }

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

                // Debug模式下跳过延迟
                if (!DEBUG_MODE) {
                    await new Promise(resolve => setTimeout(resolve, speed));
                }
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
        // Debug模式下显示轻量级Loading，避免长计算期间无反馈
        if (DEBUG_MODE) {
            DebugLoading.show('快速计算中...');
            // 让浏览器先渲染Loading
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        // 清空之前的结果
        this.stepsContainer.innerHTML = '';
        this.finalResult.style.display = 'none';

        try {
            // 获取图像数据并预处理（居中+尺度归一化）
            const rawImageData = this.drawingBoard.getImageData();
            const preprocessedImageData = ImageProcessor.preprocessImage(rawImageData, 280);
            const grayMatrix = ImageProcessor.toGrayscaleMatrix(preprocessedImageData, 28);

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
        } finally {
            if (DEBUG_MODE) {
                DebugLoading.hide();
            }
        }
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
            <h3>🔍 步骤 2：AI小侦探开始寻找线索</h3>
            <div class="step-description">
                <div class="detective-avatar">🤖</div>
                AI小侦探拿着放大镜仔细观察你的画！它会寻找这些线索：<br>
                <div style="display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap;">
                    <div class="clue-card">📐 <strong>三角形</strong>（可能是耳朵）</div>
                    <div class="clue-card">⭕ <strong>圆形</strong>（可能是脸或花瓣）</div>
                    <div class="clue-card">📏 <strong>直线</strong>（可能是花茎）</div>
                </div>
            </div>
            <div class="visualization" id="convViz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('convViz');

        const kernelConfigs = [
            { name: 'edge', label: '🔎 寻找形状', icon: '◇', desc: '扫描轮廓中...' },
            { name: 'vertical', label: '📏 寻找竖线', icon: '┃', desc: '扫描竖线中...' },
            { name: 'horizontal', label: '📐 寻找横线', icon: '━', desc: '扫描横线中...' }
        ];

        for (let config of kernelConfigs) {
            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display detective-scan';
            gridDiv.innerHTML = `
                <div class="grid-title">${config.icon} ${config.label}</div>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center;">
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">🔍 扫描中</div>
                        <canvas id="input_${config.name}"></canvas>
                    </div>
                    <div class="arrow">→</div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">✨ 发现的线索</div>
                        <canvas id="output_${config.name}"></canvas>
                    </div>
                </div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(100);

            // 执行动画卷积（不显示卷积核细节）
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
            <h3>🎒 步骤 3：整理收集到的线索</h3>
            <div class="step-description">
                <div class="detective-avatar">🤖</div>
                AI小侦探把找到的线索整理成<strong>线索卡片</strong>！<br>
                每张卡片记录了发现的重要特征。<br>
                🌈 <strong>颜色说明：红色=很明显的特征，蓝色=不太明显</strong>
            </div>
            <div class="clue-collection" id="poolViz">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const results = {};
        const vizContainer = document.getElementById('poolViz');

        const featureNames = {
            'edge': { icon: '◇', label: '形状特征', desc: '找到的轮廓' },
            'vertical': { icon: '┃', label: '竖线特征', desc: '找到的竖线' },
            'horizontal': { icon: '━', label: '横线特征', desc: '找到的横线' }
        };

        for (let [name, matrix] of Object.entries(convResults)) {
            const featureInfo = featureNames[name];
            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid-display clue-card-display';
            gridDiv.innerHTML = `
                <div class="grid-title">${featureInfo.icon} ${featureInfo.label}</div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">✨ ${featureInfo.desc}</div>
                    <canvas id="poolOutput_${name}" style="border: 3px solid #667eea; border-radius: 8px;"></canvas>
                </div>
            `;
            vizContainer.appendChild(gridDiv);

            await this.delay(100);

            // 执行池化（只显示输出热力图）
            const outputCanvas = document.getElementById(`poolOutput_${name}`);
            const pooled = await Visualizer.animatePooling(
                document.createElement('canvas'),  // 不显示输入
                outputCanvas,
                matrix,
                2,  // 池化大小
                6,  // 输入单元格较小
                12, // 输出单元格较大
                30,  // 速度
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
            <h3>📋 步骤 4：查阅档案库</h3>
            <div class="step-description">
                <div class="detective-avatar">🤖</div>
                ${useTraining ?
                    'AI小侦探打开档案库，寻找最匹配的训练样本！<br>它会对比收集到的线索，找出最相似的档案。' :
                    'AI小侦探翻开档案本，里面记录了两种物体的特征：<br>' +
                    '<div class="archive-cards">' +
                    '<div class="archive-card cat-card">' +
                    '<div class="archive-icon">🐱</div>' +
                    '<div class="archive-title">小猫档案</div>' +
                    '<div class="archive-features">✓ 顶部有尖耳朵<br>✓ 中间有圆脸<br>✓ 没有直立的茎</div>' +
                    '</div>' +
                    '<div class="archive-card flower-card">' +
                    '<div class="archive-icon">🌸</div>' +
                    '<div class="archive-title">花朵档案</div>' +
                    '<div class="archive-features">✓ 周围有花瓣<br>✓ 中间有花蕊<br>✓ 下方有花茎</div>' +
                    '</div>' +
                    '</div>'
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
            <div style="padding: 20px; background: rgba(248, 249, 250, 0.95); border-radius: 10px; margin-top: 15px; border: 2px solid rgba(102, 126, 234, 0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <div style="font-size: 1.2em; margin-bottom: 15px; text-align: center; color: #333; font-weight: 600;">
                    🔍 正在与训练样本逐个比对特征...
                </div>

                <!-- 匹配对比区域 -->
                <div id="matchingComparisonArea" style="display: flex; align-items: center; justify-content: center; gap: 20px; margin: 20px 0; min-height: 120px;">
                    <div style="text-align: center;">
                        <canvas id="currentFeaturePreview" width="80" height="80" style="border: 2px solid #667eea; border-radius: 8px; background: white;"></canvas>
                        <div style="font-size: 0.8em; margin-top: 5px; color: #555; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px;">当前图像</div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div id="matchingArrow" style="font-size: 2em; color: #ffc107; animation: arrowBounce 1s ease-in-out infinite;">⟷</div>
                        <div id="distanceValue" style="font-size: 0.85em; color: #333; margin-top: 5px; background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 4px;">计算中...</div>
                    </div>

                    <div id="comparingSampleContainer" style="text-align: center;">
                        <canvas id="comparingSample" width="80" height="80" style="border: 2px solid #ffc107; border-radius: 8px; background: white;"></canvas>
                        <div style="font-size: 0.8em; margin-top: 5px; color: #555; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px;" id="comparingLabel">训练样本</div>
                    </div>
                </div>

                <!-- 进度条 -->
                <div class="matching-progress">
                    <div class="progress-bar" id="matchingProgressBar"></div>
                </div>
                <div id="matchingStatus" style="margin-top: 10px; font-size: 0.9em; color: #333; text-align: center; background: rgba(255,255,255,0.9); padding: 8px; border-radius: 6px;">
                    准备开始对比...
                </div>

                <!-- 已对比的样本预览 -->
                <div id="comparedSamplesPreview" style="margin-top: 15px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
                </div>
            </div>
        `;

        // 绘制当前特征预览
        const currentImageData = this.drawingBoard.getImageData();
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
        const currentFeatures = KNNClassifier.extractRegionalFeatures(poolResults);

        // 调试：输出当前特征
        console.log('=== 当前图像特征 (84维混合特征) ===');
        console.log('特征向量长度:', currentFeatures.length);
        console.log('降采样特征(前10个):', currentFeatures.slice(0, 10).map(f => f.toFixed(4)));
        console.log('判别特征(上/中/下 avg/max):', currentFeatures.slice(75, 81).map(f => f.toFixed(4)));
        console.log('关键对比特征:', {
            '上-下平均差': currentFeatures[81]?.toFixed(4),
            '上-下最大差': currentFeatures[82]?.toFixed(4),
            '综合差异': currentFeatures[83]?.toFixed(4)
        });

        const progressBar = document.getElementById('matchingProgressBar');
        const status = document.getElementById('matchingStatus');
        const comparingCanvas = document.getElementById('comparingSample');
        const comparingCtx = comparingCanvas.getContext('2d');
        const comparingLabel = document.getElementById('comparingLabel');
        const distanceValue = document.getElementById('distanceValue');
        const comparedPreview = document.getElementById('comparedSamplesPreview');

        const maxDist = KNNClassifier.maxWeightedDistance();
        let distances = [];

        // 动画展示匹配过程
        for (let i = 0; i < samples.length; i++) {
            const progress = ((i + 1) / samples.length) * 100;
            progressBar.style.width = `${progress}%`;

            const sample = samples[i];
            // 用加权距离（与最终KNN预测一致），并用归一化映射得到更直观的相似度
            const distance = KNNClassifier.weightedDistance(currentFeatures, sample.features);
            const similarity = KNNClassifier.distanceToSimilarity(distance, maxDist).toFixed(1);

            // 调试：输出训练样本特征
            console.log(`样本 ${i + 1} (${sample.label}):`);
            console.log('  特征向量:', sample.features);
            console.log('  距离:', distance);
            console.log('  相似度:', similarity);

            distances.push({ index: i, distance, similarity, label: sample.label });

            // 绘制正在对比的训练样本
            comparingCtx.fillStyle = 'white';
            comparingCtx.fillRect(0, 0, 80, 80);

            if (sample.imageData && typeof sample.imageData === 'object') {
                // ImageData对象
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
            } else if (sample.imageDataURL) {
                // 从URL加载
                const img = new Image();
                img.src = sample.imageDataURL;
                comparingCtx.drawImage(img, 0, 0, 80, 80);
            } else {
                comparingCtx.fillStyle = '#f0f0f0';
                comparingCtx.fillRect(0, 0, 80, 80);
                comparingCtx.fillStyle = '#666';
                comparingCtx.font = '12px Arial';
                comparingCtx.textAlign = 'center';
                comparingCtx.fillText('样本' + (i+1), 40, 40);
            }

            comparingLabel.textContent = `${sample.label === 'cat' ? '🐱' : '🌸'} 样本 ${i + 1}`;
            distanceValue.innerHTML = `距离: <strong>${distance.toFixed(2)}</strong><br>相似度: <strong>${similarity}%</strong>`;
            status.innerHTML = `🔍 对比样本 ${i + 1}/${samples.length} - 相似度: <strong style="color: #667eea;">${similarity}%</strong>`;

            // 添加到已对比列表（小缩略图）
            const miniContainer = document.createElement('div');
            miniContainer.style.display = 'flex';
            miniContainer.style.flexDirection = 'column';
            miniContainer.style.alignItems = 'center';
            miniContainer.style.opacity = '0';
            miniContainer.style.animation = 'fadeIn 0.3s ease forwards';

            const miniCanvas = document.createElement('canvas');
            miniCanvas.width = 40;
            miniCanvas.height = 40;
            miniCanvas.style.border = `2px solid ${similarity > 80 ? '#28a745' : similarity > 60 ? '#ffc107' : '#6c757d'}`;
            miniCanvas.style.borderRadius = '6px';

            const miniCtx = miniCanvas.getContext('2d');
            if (sample.imageData && typeof sample.imageData === 'object') {
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
            } else if (sample.imageDataURL) {
                const img = new Image();
                img.src = sample.imageDataURL;
                miniCtx.drawImage(img, 0, 0, 40, 40);
            }

            const miniLabel = document.createElement('div');
            miniLabel.style.fontSize = '10px';
            miniLabel.style.marginTop = '2px';
            miniLabel.style.color = similarity > 80 ? '#28a745' : similarity > 60 ? '#ffc107' : '#6c757d';
            miniLabel.style.fontWeight = '600';
            miniLabel.textContent = `${similarity}%`;

            miniContainer.appendChild(miniCanvas);
            miniContainer.appendChild(miniLabel);
            comparedPreview.appendChild(miniContainer);

            await this.delay(200);
        }

        // 排序找出最相似的
        distances.sort((a, b) => a.distance - b.distance);
        const topMatch = distances[0];
        const topSample = samples[topMatch.index];

        status.innerHTML = `✅ 对比完成！找到最相似样本（相似度: <strong style="color: #28a745;">${topMatch.similarity}%</strong>）`;
        status.style.background = 'rgba(40, 167, 69, 0.15)';
        status.style.border = '2px solid rgba(40, 167, 69, 0.5)';
        status.style.fontWeight = '600';

        // 重新绘制最相似的样本（修复bug：之前显示的是最后一个样本）
        comparingCtx.fillStyle = 'white';
        comparingCtx.fillRect(0, 0, 80, 80);

        if (topSample.imageData && typeof topSample.imageData === 'object') {
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
        } else if (topSample.imageDataURL) {
            const img = new Image();
            img.src = topSample.imageDataURL;
            comparingCtx.drawImage(img, 0, 0, 80, 80);
        }

        comparingLabel.textContent = `${topSample.label === 'cat' ? '🐱' : '🌸'} 最相似样本`;
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
        detailDiv.style.background = 'rgba(255, 255, 255, 0.95)';
        detailDiv.style.borderRadius = '10px';
        detailDiv.style.border = '2px solid rgba(40, 167, 69, 0.5)';
        detailDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        detailDiv.innerHTML = `
            <h4 style="margin: 0 0 15px 0; text-align: center; color: #333; text-shadow: none;">
                🔬 特征详细对比 - 为什么相似度是 <span style="color: #28a745;">${topMatch.similarity}%</span>？
            </h4>
            <div style="font-size: 0.9em; text-align: center; margin-bottom: 15px; color: #555;">
                对比池化后的3个特征图（横线、竖线、边缘探测器的结果）
            </div>
            <div id="featureComparisonGrid"></div>
        `;

        container.appendChild(detailDiv);

        // 计算训练样本的池化结果（需要重新计算）
        // 注意：训练样本保存的已经是预处理后的图像，直接使用即可
        let imageData;
        if (topSample.imageData && typeof topSample.imageData === 'object') {
            imageData = topSample.imageData;
        } else if (topSample.imageDataURL) {
            // 从URL恢复ImageData
            const img = new Image();
            img.src = topSample.imageDataURL;
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 280;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 280, 280);
            imageData = ctx.getImageData(0, 0, 280, 280);
        } else {
            // 如果没有训练样本数据，使用当前画布的预处理图像
            const rawImageData = this.drawingBoard.getImageData();
            imageData = ImageProcessor.preprocessImage(rawImageData, 280);
        }
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
                <div style="background: rgba(248, 249, 250, 0.95); padding: 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="text-align: center; font-weight: bold; margin-bottom: 8px; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 6px; border-radius: 6px; color: white;">
                        ${feature.emoji} ${feature.label}
                    </div>

                    <!-- 当前图像特征 -->
                    <div style="margin-bottom: 6px;">
                        <div style="font-size: 0.75em; color: #333; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px; margin-bottom: 4px; display: inline-block;">当前图像</div>
                        <canvas id="currentFeature_${feature.key}" style="width: 100%; border: 2px solid rgba(102, 126, 234, 0.5); border-radius: 4px; image-rendering: pixelated; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></canvas>
                    </div>

                    <!-- 训练样本特征 -->
                    <div style="margin-bottom: 6px;">
                        <div style="font-size: 0.75em; color: #333; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px; margin-bottom: 4px; display: inline-block;">训练样本</div>
                        <canvas id="sampleFeature_${feature.key}" style="width: 100%; border: 2px solid rgba(40, 167, 69, 0.5); border-radius: 4px; image-rendering: pixelated; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></canvas>
                    </div>

                    <!-- 像素差异对比 -->
                    <div style="margin-bottom: 6px;">
                        <div style="font-size: 0.75em; color: #333; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px; margin-bottom: 4px; display: inline-block;">
                            📊 像素差异
                        </div>
                        <canvas id="diffFeature_${feature.key}" style="width: 100%; border: 2px solid rgba(255, 193, 7, 0.5); border-radius: 4px; image-rendering: pixelated; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></canvas>
                        <div style="font-size: 0.7em; color: #333; background: rgba(255,255,255,0.9); padding: 4px; border-radius: 3px; margin-top: 4px; text-align: center;">
                            <span style="color: #28a745;">🟢</span> 相似
                            <span style="color: #ffc107; margin-left: 8px;">🟡</span> 中等
                            <span style="color: #dc3545; margin-left: 8px;">🔴</span> 不同
                        </div>
                    </div>

                    <!-- 相似度条 -->
                    <div style="margin-top: 10px;">
                        <div style="font-size: 0.85em; text-align: center; margin-bottom: 4px; color: #333; background: rgba(255,255,255,0.9); padding: 4px; border-radius: 4px;">
                            匹配度: <strong style="color: #28a745;">${featureSimilarity}%</strong>
                        </div>
                        <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${featureSimilarity}%; height: 100%; background: linear-gradient(90deg, #28a745, #20c997); border-radius: 4px; transition: width 1s ease;"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        gridHTML += '</div>';

        // 添加总结
        gridHTML += `
            <div style="margin-top: 15px; padding: 12px; background: rgba(255,255,255,0.95); border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="font-size: 0.9em; color: #333; line-height: 1.6;">
                    💡 <strong style="color: #667eea;">如何计算总相似度？</strong><br>
                    将3个特征图展平成一个长向量（<strong>507维</strong>），然后计算两个向量之间的<strong>欧氏距离</strong>。<br>
                    <span style="color: #28a745;">距离越小 → 特征越接近 → 相似度越高！</span>
                </div>
            </div>
        `;

        grid.innerHTML = gridHTML;

        // 绘制热力图和差异图
        await this.delay(100); // 等待DOM渲染

        for (let feature of featureNames) {
            const currentCanvas = document.getElementById(`currentFeature_${feature.key}`);
            const sampleCanvas = document.getElementById(`sampleFeature_${feature.key}`);
            const diffCanvas = document.getElementById(`diffFeature_${feature.key}`);

            const currentMatrix = currentPoolResults[feature.key];
            const sampleMatrix = samplePoolResults[feature.key];

            if (currentCanvas) {
                Visualizer.drawHeatmap(currentCanvas, currentMatrix, 8);
            }
            if (sampleCanvas) {
                Visualizer.drawHeatmap(sampleCanvas, sampleMatrix, 8);
            }
            if (diffCanvas) {
                // 绘制差异图
                this.drawDifferenceMap(diffCanvas, currentMatrix, sampleMatrix, 8);
            }
        }
    }

    // 绘制差异图（显示两个矩阵的像素差异）
    drawDifferenceMap(canvas, matrix1, matrix2, cellSize = 8) {
        const ctx = canvas.getContext('2d');
        const height = matrix1.length;
        const width = matrix1[0].length;

        canvas.width = width * cellSize;
        canvas.height = height * cellSize;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const val1 = matrix1[y][x];
                const val2 = matrix2[y][x];
                const diff = Math.abs(val1 - val2);

                // 根据差异大小选择颜色
                let color;
                if (diff < 0.1) {
                    // 非常相似 - 绿色
                    const intensity = 1 - (diff * 10);
                    color = `rgb(${Math.floor(40 + (255-40) * (1-intensity))}, ${Math.floor(167 + (255-167) * (1-intensity))}, ${Math.floor(69 + (255-69) * (1-intensity))})`;
                } else if (diff < 0.3) {
                    // 中等差异 - 黄色
                    const t = (diff - 0.1) / 0.2;
                    const r = Math.floor(40 + (255 - 40) * t);
                    const g = Math.floor(167 + (193 - 167) * t);
                    const b = Math.floor(69 + (7 - 69) * t);
                    color = `rgb(${r}, ${g}, ${b})`;
                } else {
                    // 差异大 - 红色
                    const t = Math.min(1, (diff - 0.3) / 0.4);
                    const r = 255;
                    const g = Math.floor(193 - 193 * t);
                    const b = Math.floor(7 - 7 * t);
                    color = `rgb(${r}, ${g}, ${b})`;
                }

                ctx.fillStyle = color;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // 绘制网格线
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
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

        // 添加边框高亮最大差异区域
        let maxDiff = 0;
        let maxPos = { x: 0, y: 0 };
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const diff = Math.abs(matrix1[y][x] - matrix2[y][x]);
                if (diff > maxDiff) {
                    maxDiff = diff;
                    maxPos = { x, y };
                }
            }
        }

        // 高亮最大差异位置
        if (maxDiff > 0.2) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(maxPos.x * cellSize, maxPos.y * cellSize, cellSize, cellSize);
        }
    }

    // 显示最相似的样本
    async showSimilarSamples(neighbors, predictedLabel) {
        const samples = this.trainingManager.getSamples();

        // 将中文标签转换为英文
        const predictedLabelEn = predictedLabel === '小猫' ? 'cat' : 'flower';

        let html = `
            <div style="margin-top: 25px; padding: 20px; background: rgba(248, 249, 250, 0.95); border-radius: 10px; border: 2px solid rgba(102, 126, 234, 0.3); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h4 style="margin: 0 0 15px 0; font-size: 1.2em; color: #333; text-align: center;">🎯 最相似的训练样本（K=${neighbors.length}）</h4>
                <div class="similar-samples-grid" id="similarSamplesContainer">
        `;

        // 先创建占位符
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            const sample = samples[neighbor.index];
            const similarity = KNNClassifier.distanceToSimilarity(neighbor.distance).toFixed(1);
            const isMatch = neighbor.label === predictedLabelEn;

            html += `
                <div class="similar-sample-item ${isMatch ? 'match' : 'nomatch'}" style="animation-delay: ${i * 0.2}s;">
                    <div class="sample-rank">#${i + 1}</div>
                    <div style="margin: 15px 0;">
                        <canvas id="similarSampleCanvas${i}" width="100" height="100" style="border-radius: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"></canvas>
                    </div>
                    <div class="sample-emoji">${sample.label === 'cat' ? '🐱' : '🌸'}</div>
                    ${isMatch ? '<div class="match-badge">✓ 匹配</div>' : ''}
                    <div class="sample-similarity">
                        <div class="similarity-text" style="font-size: 1.1em; font-weight: 600; color: #667eea; margin-top: 8px;">${similarity}% 相似</div>
                    </div>
                </div>
            `;
        }

        html += `
                </div>
                <div style="margin-top: 15px; font-size: 0.9em; color: #333; line-height: 1.6; background: rgba(255,255,255,0.9); padding: 12px; border-radius: 8px; border: 1px solid rgba(102, 126, 234, 0.2);">
                    💡 <strong style="color: #667eea;">工作原理：</strong><br>
                    • 计算当前图像与每个训练样本的<strong>特征距离</strong>（${neighbors.length}个最近邻）<br>
                    • 距离越小 = 特征越相似 = 相似度越高<br>
                    • <strong style="color: #28a745;">${neighbors.filter(n => n.label === predictedLabelEn).length} 个样本</strong>投票 "${predictedLabel}"，所以最终结果是<strong style="color: #667eea;">${predictedLabel}</strong>！
                </div>
            </div>
        `;

        // 需要异步绘制图像
        setTimeout(() => {
            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];
                const sample = samples[neighbor.index];
                const canvas = document.getElementById(`similarSampleCanvas${i}`);

                if (canvas && sample.imageData && typeof sample.imageData === 'object') {
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
                } else if (canvas && sample.imageDataURL) {
                    // 从URL加载图像
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, 100, 100);
                    };
                    img.src = sample.imageDataURL;
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
            const featureVector = KNNClassifier.extractRegionalFeatures(features);
            const prediction = this.classifier.predict(featureVector, trainingSamples);

            if (prediction) {
                const isCat = prediction.label === 'cat';
                const emoji = isCat ? '🐱' : '🌸';
                const labelText = isCat ? '小猫' : '花朵';

                return {
                    emoji: emoji,
                    label: labelText,
                    confidence: prediction.confidence,
                    reason: `🎓 <strong>使用你训练的模型！</strong><br>` +
                            `AI小侦探找到了 <strong>${prediction.neighbors.length} 个最相似的训练样本</strong>，` +
                            `其中 ${prediction.neighbors.filter(n => n.label === prediction.label).length} 个是${labelText}。<br>` +
                            `最相似样本的距离：${prediction.closestDistance.toFixed(2)}`,
                    usedTraining: true,
                    neighbors: prediction.neighbors  // 传递neighbors信息用于可视化
                };
            }
        }

        // 如果没有训练数据，使用基于区域的简单规则
        // 猫的特征：上方有尖角（耳朵）、中间有圆形（脸）
        // 花的特征：中间有圆形分布（花瓣）、下方有竖线（花茎）

        const edgeFeature = features.edge;
        const vertFeature = features.vertical;
        const horizFeature = features.horizontal;
        const featSize = edgeFeature.length;

        // 特征1：检测上方的尖角（猫耳朵）
        let topTriangleScore = 0;
        const topRegion = Math.floor(featSize * 0.3);
        for (let y = 0; y < topRegion; y++) {
            for (let x = 0; x < featSize; x++) {
                // 边缘特征强 = 可能是尖角
                topTriangleScore += edgeFeature[y][x];
            }
        }
        topTriangleScore /= (topRegion * featSize);

        // 特征2：检测中间的圆形区域（脸或花瓣）
        let centerCircleScore = 0;
        const centerStart = Math.floor(featSize * 0.3);
        const centerEnd = Math.floor(featSize * 0.7);
        for (let y = centerStart; y < centerEnd; y++) {
            for (let x = centerStart; x < centerEnd; x++) {
                centerCircleScore += edgeFeature[y][x];
            }
        }
        const centerArea = (centerEnd - centerStart) * (centerEnd - centerStart);
        centerCircleScore /= centerArea;

        // 特征3：检测下方的竖线（花茎）
        let bottomVerticalScore = 0;
        const bottomStart = Math.floor(featSize * 0.6);
        const centerX = Math.floor(featSize / 2);
        const xRange = Math.floor(featSize * 0.2);
        for (let y = bottomStart; y < featSize; y++) {
            for (let x = Math.max(0, centerX - xRange); x < Math.min(featSize, centerX + xRange); x++) {
                bottomVerticalScore += vertFeature[y][x];
            }
        }
        const bottomArea = (featSize - bottomStart) * xRange * 2;
        bottomVerticalScore /= bottomArea;

        // 特征4：检测周围的分散色块（花瓣）
        let peripheralScore = 0;
        const midX = Math.floor(featSize / 2);
        const midY = Math.floor(featSize / 2);
        const outerRadius = Math.floor(featSize * 0.4);
        const innerRadius = Math.floor(featSize * 0.2);
        
        for (let y = 0; y < featSize; y++) {
            for (let x = 0; x < featSize; x++) {
                const dist = Math.sqrt((x - midX) ** 2 + (y - midY) ** 2);
                if (dist > innerRadius && dist < outerRadius) {
                    peripheralScore += edgeFeature[y][x];
                }
            }
        }
        peripheralScore /= (outerRadius - innerRadius) * featSize;

        // 调试信息
        console.log('分类特征:', {
            topTriangleScore: topTriangleScore.toFixed(3),
            centerCircleScore: centerCircleScore.toFixed(3),
            bottomVerticalScore: bottomVerticalScore.toFixed(3),
            peripheralScore: peripheralScore.toFixed(3)
        });

        // 判断逻辑：猫 vs 花
        let isCat = false;
        let confidence = 60;
        let detectedFeatures = [];

        // 猫的特征组合：上方尖角 + 中间圆形 - 下方竖线
        const catScore = topTriangleScore * 2 + centerCircleScore - bottomVerticalScore;
        
        // 花的特征组合：周围分散 + 下方竖线 + 中间圆形
        const flowerScore = peripheralScore * 1.5 + bottomVerticalScore * 2 + centerCircleScore * 0.5;

        console.log('得分:', { catScore: catScore.toFixed(3), flowerScore: flowerScore.toFixed(3) });

        if (catScore > flowerScore) {
            isCat = true;
            confidence = Math.min(95, 60 + Math.abs(catScore - flowerScore) * 30);
            
            if (topTriangleScore > 0.1) detectedFeatures.push('顶部发现尖尖的三角形（耳朵）');
            if (centerCircleScore > 0.1) detectedFeatures.push('中间发现圆圆的形状（脸蛋）');
            detectedFeatures.push('没有检测到花茎特征');
        } else {
            isCat = false;
            confidence = Math.min(95, 60 + Math.abs(flowerScore - catScore) * 30);
            
            if (peripheralScore > 0.1) detectedFeatures.push('周围发现分散的圆形（花瓣）');
            if (bottomVerticalScore > 0.05) detectedFeatures.push('下方发现直直的竖线（花茎）');
            if (centerCircleScore > 0.1) detectedFeatures.push('中心发现圆形（花蕊）');
        }

        if (isCat) {
            return {
                emoji: '🐱',
                label: '小猫',
                confidence: Math.round(confidence),
                reason: `AI小侦探发现了这些线索：<br>` +
                        `• ${detectedFeatures.join('<br>• ')}<br>` +
                        `<strong>结论：</strong>这些特征符合小猫的档案！`
            };
        } else {
            return {
                emoji: '🌸',
                label: '花朵',
                confidence: Math.round(confidence),
                reason: `AI小侦探发现了这些线索：<br>` +
                        `• ${detectedFeatures.join('<br>• ')}<br>` +
                        `<strong>结论：</strong>这些特征符合花朵的档案！`
            };
        }
    }

    delay(ms) {
        // Debug模式下跳过延迟
        if (DEBUG_MODE) {
            return Promise.resolve();
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 添加训练样本（在训练模式下使用）
    async addTrainingSample(label) {
        if (DEBUG_MODE) {
            DebugLoading.show('提取特征并保存训练样本...');
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        try {
            // 重要修复：
            // 训练时必须“从当前画布重新计算特征”，避免出现：
            // 缩略图是A（比如简化猫），但特征却来自上一张图B（比如标准猫）
            // 这会导致看起来不同的两张图也可能显示“100%相似/距离0”。

            // 从当前画布获取并预处理（缩放+居中）
            const rawImageData = this.drawingBoard.getImageData();
            const preprocessedImageData = ImageProcessor.preprocessImage(rawImageData, 280);

            // 计算特征（卷积->归一化->池化）
            const grayMatrix = ImageProcessor.toGrayscaleMatrix(preprocessedImageData, 28);
            const convResults = {};
            for (let [name, kernel] of Object.entries(this.kernels)) {
                const convResult = ImageProcessor.convolve(grayMatrix, kernel);
                convResults[name] = ImageProcessor.normalize(convResult);
            }

            const poolResults = {};
            for (let [name, matrix] of Object.entries(convResults)) {
                poolResults[name] = ImageProcessor.maxPool(matrix, 2);
            }

            // 提取特征向量（84维混合特征）
            const features = KNNClassifier.extractRegionalFeatures(poolResults);

            // 保存训练数据（缩略图用 preprocessedImageData，保证和特征一致）
            this.trainingManager.addSample(features, label, preprocessedImageData);

            // 清空缓存，避免被误用
            this.lastPoolResults = null;

            return this.trainingManager.getStats();
        } finally {
            if (DEBUG_MODE) {
                DebugLoading.hide();
            }
        }
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
    // 显示Debug模式指示器
    if (DEBUG_MODE) {
        const debugIndicator = document.getElementById('debugIndicator');
        if (debugIndicator) {
            debugIndicator.style.display = 'block';
        }
    }

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
            if (sample.imageData && typeof sample.imageData === 'object') {
                // ImageData对象，直接绘制
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
            } else if (sample.imageDataURL) {
                // 还有URL但imageData还在加载中，异步绘制
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, 60, 60);
                };
                img.src = sample.imageDataURL;
                // 先显示占位符
                ctx.fillStyle = '#f8f9fa';
                ctx.fillRect(0, 0, 60, 60);
                ctx.fillStyle = '#ccc';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('加载中...', 30, 30);
            } else {
                // 如果没有imageData，显示占位符
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
            label.textContent = sample.label === 'cat' ? '🐱' : '🌸';

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
        document.getElementById('catCount').textContent = stats.catCount;
        document.getElementById('flowerCount').textContent = stats.flowerCount;
    }

    // 监听训练数据加载完成事件
    window.addEventListener('trainingDataLoaded', () => {
        updateTrainingSamplesDisplay();
        updateStats();
        console.log('训练数据已从本地缓存加载完成');
    });

    // 初始化时更新显示
    updateTrainingSamplesDisplay();
    updateStats();

    // 模式切换
    document.getElementById('recognitionMode').addEventListener('click', () => {
        currentMode = 'recognition';
        document.getElementById('recognitionMode').classList.add('active');
        document.getElementById('trainingMode').classList.remove('active');
        document.getElementById('trainingControls').style.display = 'none';
        document.getElementById('trainingTip').style.display = 'none';
        document.getElementById('drawingSectionTitle').textContent = '1️⃣ 画一幅画';
        document.getElementById('modeInfo').textContent = '💡 提示：可以用鼠标画，或者点击按钮生成简笔画';
    });

    document.getElementById('trainingMode').addEventListener('click', () => {
        currentMode = 'training';
        document.getElementById('trainingMode').classList.add('active');
        document.getElementById('recognitionMode').classList.remove('active');
        document.getElementById('trainingControls').style.display = 'block';
        document.getElementById('trainingTip').style.display = 'block';
        document.getElementById('drawingSectionTitle').textContent = '1️⃣ 画一幅画并标注';
        document.getElementById('modeInfo').textContent = '🎓 提示：画好后，点击下方按钮告诉AI小侦探这是什么';
        updateStats();
        updateTrainingSamplesDisplay();
    });

    // 训练模式：标注为小猫
    document.getElementById('labelCat').addEventListener('click', async () => {
        const stats = await processor.addTrainingSample('cat');
        updateStats();
        updateTrainingSamplesDisplay();
        drawingBoard.clear();

        // 显示反馈
        alert(`✅ 小猫样本已添加！\n总样本数：${stats.total}\n小猫：${stats.catCount} | 花朵：${stats.flowerCount}`);
    });

    // 训练模式：标注为花朵
    document.getElementById('labelFlower').addEventListener('click', async () => {
        const stats = await processor.addTrainingSample('flower');
        updateStats();
        updateTrainingSamplesDisplay();
        drawingBoard.clear();

        // 显示反馈
        alert(`✅ 花朵样本已添加！\n总样本数：${stats.total}\n小猫：${stats.catCount} | 花朵：${stats.flowerCount}`);
    });

    // 清空训练数据
    document.getElementById('clearTrainingData').addEventListener('click', () => {
        if (confirm('确定要清空所有训练数据吗？')) {
            processor.clearTrainingData();
            updateStats();
            updateTrainingSamplesDisplay();
        }
    });

    // 生成小猫
    document.getElementById('generateCat').addEventListener('click', () => {
        drawingBoard.generateCat();
    });

    // 生成花朵
    document.getElementById('generateFlower').addEventListener('click', () => {
        drawingBoard.generateFlower();
    });

    // 生成简化小猫
    document.getElementById('generateSimpleCat').addEventListener('click', () => {
        drawingBoard.generateSimpleCat();
    });

    // 生成简化花朵
    document.getElementById('generateSimpleFlower').addEventListener('click', () => {
        drawingBoard.generateSimpleFlower();
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
    drawingBoard.generateCat();
    updateStats();
    updateTrainingSamplesDisplay();
});
