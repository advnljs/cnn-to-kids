// Debug模式检测
const DEBUG_MODE = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === 'true';
})();

// 训练数据存储key（当“特征定义/权重”升级时更换，避免旧数据与新算法混用）
const TRAINING_STORAGE_KEY = 'cnn_training_data_catflower_v2';

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
            localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(samplesToSave));
        } catch (e) {
            console.warn('无法保存训练数据到localStorage:', e);
        }
    }

    // 从localStorage加载
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(TRAINING_STORAGE_KEY);
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

    // 空间特征的权重（3个特征图的 5×5 降采样共75维）
    // 为了更强调“耳朵/花瓣/花茎”等关键线索，这里适当降低空间特征影响
    static spatialWeight() {
        return 0.35;
    }

    // 猫/花判别特征的维度权重（越大=越重要）
    static discriminativeWeights() {
        // 9维判别特征（与 extractRegionalFeatures 的后9维一一对应）：
        // 0 左耳强度, 1 右耳强度, 2 耳朵中间空隙(越小越像猫)
        // 3 花瓣扇区占比, 4 花瓣峰值程度, 5 花瓣对比度
        // 6 花茎连续长度比例, 7 花茎命中比例, 8 花茎漂移(越小越直)
        return [25, 25, 20, 30, 25, 20, 35, 25, 15];
    }

    // “按类别加强权重”：对猫样本更看重耳朵，对花样本更看重花瓣+花茎
    static discriminativeWeightsForLabel(label) {
        const base = KNNClassifier.discriminativeWeights();
        const weights = base.slice();

        const catBoost = 1.7;
        const flowerBoost = 1.7;

        if (label === 'cat') {
            // 0-2：耳朵相关
            for (let i = 0; i <= 2; i++) weights[i] = weights[i] * catBoost;
        } else if (label === 'flower') {
            // 3-8：花瓣+花茎相关
            for (let i = 3; i <= 8; i++) weights[i] = weights[i] * flowerBoost;
        }

        return weights;
    }

    // 将距离映射为 0-100 的相似度（用于展示）
    // 说明：我们用“最大可能距离”做归一化，让数值更直观、跨样本更稳定。
    // 加权距离的最大值（特征都在0-1时）约为 sqrt(75*spatialWeight + sum(maxDiscWeights))。
    static maxWeightedDistance() {
        const spatialDims = 75;
        const spatialWeight = KNNClassifier.spatialWeight();

        // 取“猫增强”和“花增强”两种情况下每一维的最大权重，作为全局上界，保证相似度可比
        const catW = KNNClassifier.discriminativeWeightsForLabel('cat');
        const flowerW = KNNClassifier.discriminativeWeightsForLabel('flower');
        const maxW = catW.map((w, i) => Math.max(w, flowerW[i] ?? w));
        const discSum = maxW.reduce((acc, w) => acc + w, 0);

        return Math.sqrt(spatialDims * spatialWeight + discSum);
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
        const spatialWeight = KNNClassifier.spatialWeight();
        const discWeights = KNNClassifier.discriminativeWeights();

        let sum = 0;

        // 前75维：空间特征（权重1.0）
        for (let i = 0; i < spatialDims && i < features1.length && i < features2.length; i++) {
            const diff = features1[i] - features2[i];
            sum += spatialWeight * diff * diff;
        }

        // 后9维：猫/花判别特征（按维度加权）
        for (let j = 0; j < discWeights.length; j++) {
            const i = spatialDims + j;
            if (i >= features1.length || i >= features2.length) break;
            const diff = features1[i] - features2[i];
            sum += discWeights[j] * diff * diff;
        }

        return Math.sqrt(sum);
    }

    // 按“训练样本类别”加权的距离（用于匹配/排序）
    static weightedDistanceByLabel(features1, features2, sampleLabel) {
        const spatialDims = 75;
        const spatialWeight = KNNClassifier.spatialWeight();
        const discWeights = KNNClassifier.discriminativeWeightsForLabel(sampleLabel);

        let sum = 0;

        for (let i = 0; i < spatialDims && i < features1.length && i < features2.length; i++) {
            const diff = features1[i] - features2[i];
            sum += spatialWeight * diff * diff;
        }

        for (let j = 0; j < discWeights.length; j++) {
            const i = spatialDims + j;
            if (i >= features1.length || i >= features2.length) break;
            const diff = features1[i] - features2[i];
            sum += discWeights[j] * diff * diff;
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

        // 第二部分：关键判别特征（专门区分小猫/花朵）
        // 目标：让“猫耳朵/花瓣/花茎”在KNN距离里更有存在感，从而减少猫和花被判得很像。
        const edge = poolResults['edge'];
        const vertical = poolResults['vertical'];
        const size = edge.length;
        const mid = Math.floor(size / 2);

        // 1) 猫耳朵：左右上角强边缘 + 中间相对更空
        const earRows = Math.max(1, Math.floor(size * 0.35));
        let leftSum = 0, leftCnt = 0;
        let rightSum = 0, rightCnt = 0;
        let gapSum = 0, gapCnt = 0;
        for (let y = 0; y < earRows; y++) {
            for (let x = 0; x < mid - 1; x++) {
                leftSum += edge[y][x];
                leftCnt++;
            }
            for (let x = mid + 1; x < size; x++) {
                rightSum += edge[y][x];
                rightCnt++;
            }
            for (let x = mid - 1; x <= mid + 1; x++) {
                if (x >= 0 && x < size) {
                    gapSum += edge[y][x];
                    gapCnt++;
                }
            }
        }
        const leftEarAvg = leftCnt > 0 ? leftSum / leftCnt : 0;     // 0-1
        const rightEarAvg = rightCnt > 0 ? rightSum / rightCnt : 0; // 0-1
        const earGapAvg = gapCnt > 0 ? gapSum / gapCnt : 0;         // 0-1（越低越像猫）

        // 2) 花瓣：环形区域“多峰值”分布（多瓣=多方向突起）
        const sectorCount = 12;
        const sectorSums = Array(sectorCount).fill(0);
        const sectorCnts = Array(sectorCount).fill(0);
        const cx = (size - 1) / 2;
        const cy = (size - 1) / 2;
        const rMin = size * 0.28;
        const rMax = size * 0.50;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const r = Math.sqrt(dx * dx + dy * dy);
                if (r >= rMin && r <= rMax) {
                    let a = Math.atan2(dy, dx);
                    if (a < 0) a += Math.PI * 2;
                    const idx = Math.min(sectorCount - 1, Math.floor((a / (Math.PI * 2)) * sectorCount));
                    sectorSums[idx] += edge[y][x];
                    sectorCnts[idx] += 1;
                }
            }
        }
        const sectorAvgs = sectorSums.map((s, i) => (sectorCnts[i] > 0 ? s / sectorCnts[i] : 0)); // 0-1
        const mean = sectorAvgs.reduce((acc, v) => acc + v, 0) / sectorCount;
        const max = Math.max(...sectorAvgs);
        const min = Math.min(...sectorAvgs);
        const peakedness = max / (mean + 1e-9);              // >=1
        const contrast = (max - min) / (max + 1e-9);         // 0-1
        const petalFactor = 1.35;
        const petalAbsFloor = 0.15;
        const petalCount = sectorAvgs.filter(v => v > mean * petalFactor && v > petalAbsFloor).length;
        const petalFrac = petalCount / sectorCount;          // 0-1
        const peakedNorm = Math.max(0, Math.min(1, (peakedness - 1) / 1.5)); // 1->0, 2.5->1
        const contrastNorm = Math.max(0, Math.min(1, contrast));

        // 3) 花茎：下半部“长 + 大致垂直（允许轻微弯）”
        const bottomStart = Math.floor(size * 0.55);
        const bottomLen = Math.max(1, size - bottomStart);
        const bandHalfWidth = 3;
        const rowHitThreshold = 0.45;
        let hitRows = 0;
        let longestRun = 0;
        let currentRun = 0;
        const hitXs = [];
        for (let y = bottomStart; y < size; y++) {
            let best = -Infinity;
            let bestX = mid;
            for (let x = mid - bandHalfWidth; x <= mid + bandHalfWidth; x++) {
                if (x >= 0 && x < size) {
                    const v = vertical[y][x];
                    if (v > best) {
                        best = v;
                        bestX = x;
                    }
                }
            }
            const hit = best >= rowHitThreshold;
            if (hit) {
                hitRows++;
                hitXs.push(bestX);
                currentRun++;
                longestRun = Math.max(longestRun, currentRun);
            } else {
                currentRun = 0;
            }
        }
        let drift = 0;
        if (hitXs.length >= 2) {
            drift = Math.max(...hitXs) - Math.min(...hitXs);
        }
        const stemRunRatio = longestRun / bottomLen;         // 0-1
        const stemHitRatio = hitRows / bottomLen;            // 0-1
        const stemDriftNorm = Math.max(0, Math.min(1, drift / 3)); // 0=很直，1=很飘

        // 按顺序加入9维判别特征（与 discriminativeWeights 对齐）
        features.push(leftEarAvg);
        features.push(rightEarAvg);
        features.push(earGapAvg);
        features.push(petalFrac);
        features.push(peakedNorm);
        features.push(contrastNorm);
        features.push(stemRunRatio);
        features.push(stemHitRatio);
        features.push(stemDriftNorm);

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
            distance: KNNClassifier.weightedDistanceByLabel(features, sample.features, sample.label)
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
        // 2) 相似度差距阈值：sim0 - sim1 >= 阈值（与 distanceToSimilarity 的映射一致）
        const d0 = neighbors[0]?.distance ?? Infinity;
        const d1 = neighbors[1]?.distance ?? Infinity;
        const ratioThreshold = 1.8;
        const similarityMarginThreshold = 12; // 百分点
        const ratio1 = isFinite(d0) ? (d1 / (d0 + 1e-9)) : 1;
        const sim0 = KNNClassifier.distanceToSimilarity(d0);
        const sim1 = KNNClassifier.distanceToSimilarity(d1);
        const similarityMargin = sim0 - sim1;

        let predictedLabel = null;
        let confidence = 0;

        if (isFinite(d0) && isFinite(d1) && (ratio1 >= ratioThreshold || similarityMargin >= similarityMarginThreshold)) {
            // 直接采用第一近邻
            predictedLabel = neighbors[0].label;
            // 置信度基于第一近邻相似度（与可视化一致），并给出最低保底
            confidence = Math.max(85, Math.round(sim0));
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

    // 生成简化猫（保留“圆脸 + 耳朵”，更像猫也更好区分花朵）
    generateSimpleCat() {
        this.clear();
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 8;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // 画简化的圆脸（关键：没有圆脸时容易和花朵混淆）
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + 10, 70, 0, Math.PI * 2);
        this.ctx.stroke();

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

        // 最近一次处理用到的图像（用于“先自动居中再识别”的展示）
        this.lastRawImageData = null;
        this.lastPreprocessedImageData = null;

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

            // 保存，供步骤展示使用（避免“位置不同导致看不懂”）
            this.lastRawImageData = rawImageData;
            this.lastPreprocessedImageData = preprocessedImageData;

            // 步骤1：AI小侦探看到图像
            await this.showStep1(grayMatrix);
            await this.delay(800);

            // 步骤2：AI小侦探寻找线索（包含卷积+池化计算）
            const poolResults = await this.showStep2(grayMatrix);
            this.lastPoolResults = poolResults;  // 保存用于训练
            await this.delay(800);

            // 步骤3：展示收集到的线索卡片
            await this.showStep3(poolResults);
            await this.delay(800);

            // 步骤4：对比档案，得出结论
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
            <h3>📸 步骤 1：AI小侦探看到了你的画</h3>
            <div class="step-description">
                <div class="detective-avatar">🤖</div>
                <strong>"先把图放到中间，这样更好观察！"</strong><br>
                AI小侦探会先<strong>自动居中</strong>你的画，再开始找线索（这样位置偏左/偏右也不怕）。
            </div>
            <div class="visualization" style="justify-content: center; align-items: center;">
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center;">
                    <div style="text-align: center;">
                        <canvas id="rawPreview" width="180" height="180" style="border: 4px solid #6c757d; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);"></canvas>
                        <div style="margin-top: 8px; font-size: 14px; color: #666;">你画的图（原位置）</div>
                    </div>
                    <div class="arrow" style="font-size: 2.2em;">→</div>
                    <div style="text-align: center;">
                        <canvas id="centeredPreview" width="180" height="180" style="border: 4px solid #667eea; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"></canvas>
                        <div style="margin-top: 8px; font-size: 14px; color: #666;">AI自动居中后</div>
                    </div>
                </div>
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(100);

        const rawCanvas = document.getElementById('rawPreview');
        const centeredCanvas = document.getElementById('centeredPreview');
        const rawCtx = rawCanvas?.getContext('2d');
        const centeredCtx = centeredCanvas?.getContext('2d');

        const rawImageData = this.lastRawImageData ?? this.drawingBoard.getImageData();
        const preprocessedImageData = this.lastPreprocessedImageData ?? ImageProcessor.preprocessImage(rawImageData, 280);

        // raw
        if (rawCtx) {
            const tmp = document.createElement('canvas');
            tmp.width = rawImageData.width;
            tmp.height = rawImageData.height;
            tmp.getContext('2d').putImageData(rawImageData, 0, 0);
            rawCtx.fillStyle = 'white';
            rawCtx.fillRect(0, 0, 180, 180);
            rawCtx.drawImage(tmp, 0, 0, 180, 180);
        }

        // centered
        if (centeredCtx) {
            const tmp = document.createElement('canvas');
            tmp.width = preprocessedImageData.width;
            tmp.height = preprocessedImageData.height;
            tmp.getContext('2d').putImageData(preprocessedImageData, 0, 0);
            centeredCtx.fillStyle = 'white';
            centeredCtx.fillRect(0, 0, 180, 180);
            centeredCtx.drawImage(tmp, 0, 0, 180, 180);
        }
    }

    async showStep2(matrix) {
        // 先在后台计算特征（不展示复杂过程）
        const convResults = {};
        for (let [name, kernel] of Object.entries(this.kernels)) {
            const convResult = ImageProcessor.convolve(matrix, kernel);
            convResults[name] = ImageProcessor.normalize(convResult);
        }
        
        const poolResults = {};
        for (let [name, mat] of Object.entries(convResults)) {
            poolResults[name] = ImageProcessor.maxPool(mat, 2);
        }
        
        // 分析特征（简单规则）
        const features = this.analyzeFeatures(poolResults);
        
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>🔍 步骤 2：AI小侦探开始寻找线索</h3>
            <div class="step-description">
                <div class="detective-avatar">🤖</div>
                <strong>"让我拿放大镜仔细看看..."</strong>
            </div>
            <div class="visualization" style="justify-content: center;">
                <div style="position: relative; display: inline-block;">
                    <canvas id="scanCanvas" width="280" height="280" style="border: 4px solid #667eea; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"></canvas>
                    <div id="magnifier" style="position: absolute; width: 60px; height: 60px; border: 4px solid #ff6b6b; border-radius: 50%; pointer-events: none; opacity: 0; transition: all 0.5s ease; box-shadow: 0 0 20px rgba(255,107,107,0.5);"></div>
                    <div id="speechBubble" style="position: absolute; background: #333; color: white; padding: 10px 15px; border-radius: 20px; font-size: 16px; font-weight: bold; opacity: 0; transition: opacity 0.3s; white-space: nowrap; z-index: 100;"></div>
                </div>
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(300);

        // 绘制“居中后的图”（与识别计算使用同一份图），避免因为位置不同让小朋友困惑
        const canvas = document.getElementById('scanCanvas');
        const ctx = canvas.getContext('2d');
        const rawImageData = this.lastRawImageData ?? this.drawingBoard.getImageData();
        const preprocessedImageData = this.lastPreprocessedImageData ?? ImageProcessor.preprocessImage(rawImageData, 280);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = preprocessedImageData.width;
        tempCanvas.height = preprocessedImageData.height;
        tempCanvas.getContext('2d').putImageData(preprocessedImageData, 0, 0);

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 280, 280);
        ctx.drawImage(tempCanvas, 0, 0, 280, 280);

        const magnifier = document.getElementById('magnifier');
        const bubble = document.getElementById('speechBubble');
        
        // 扫描动画序列 - 更详细的特征检测
        const scanSequence = [
            // 左耳检测
            { 
                region: 'leftEar', 
                x: 80, y: 50, 
                found: features.hasLeftEar,
                foundText: '✨ 发现左边的尖角！像猫耳朵！',
                notFoundText: '🔍 左上没有发现尖角...',
                color: '#28a745',
                markType: 'leftTriangle'
            },
            // 右耳检测
            { 
                region: 'rightEar', 
                x: 200, y: 50, 
                found: features.hasRightEar,
                foundText: '✨ 发现右边的尖角！又一只耳朵！',
                notFoundText: '🔍 右上没有发现尖角...',
                color: '#28a745',
                markType: 'rightTriangle'
            },
            // 花瓣检测（周围）
            { 
                region: 'petals', 
                x: 140, y: 100, 
                found: features.hasPetals,
                foundText: `✨ 发现 ${features.petalCount} 片花瓣围成一圈！`,
                notFoundText: '🔍 没有发现花瓣分布...',
                color: '#e83e8c',
                markType: 'petals'
            },
            // 中心检测
            { 
                region: 'center', 
                x: 140, y: 140, 
                found: features.hasRoundShape,
                foundText: features.hasEars ? '✨ 发现圆圆的脸蛋！' : '✨ 发现圆形的花蕊！',
                notFoundText: '🔍 中间没有发现圆形...',
                color: '#667eea',
                markType: 'circle'
            },
            // 花茎检测
            { 
                region: 'stem', 
                x: 140, y: 220, 
                found: features.hasStem,
                foundText: '✨ 发现直直的花茎！',
                notFoundText: '🔍 底部没有发现花茎...',
                color: '#17a2b8',
                markType: 'line'
            }
        ];

        magnifier.style.opacity = '1';

        for (let scan of scanSequence) {
            // 移动放大镜
            magnifier.style.left = (scan.x - 30) + 'px';
            magnifier.style.top = (scan.y - 30) + 'px';
            magnifier.style.borderColor = scan.found ? scan.color : '#999';
            
            await this.delay(500);
            
            // 显示气泡
            bubble.textContent = scan.found ? scan.foundText : scan.notFoundText;
            bubble.style.background = scan.found ? scan.color : '#666';
            bubble.style.left = scan.x < 140 ? (scan.x + 50) + 'px' : (scan.x - 180) + 'px';
            bubble.style.top = (scan.y - 10) + 'px';
            bubble.style.opacity = '1';
            
            // 如果发现了特征，在图上标记
            if (scan.found) {
                ctx.strokeStyle = scan.color;
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 4]);
                
                if (scan.markType === 'leftTriangle') {
                    // 左耳标记
                    ctx.beginPath();
                    ctx.moveTo(50, 90);
                    ctx.lineTo(90, 30);
                    ctx.lineTo(130, 90);
                    ctx.closePath();
                    ctx.stroke();
                } else if (scan.markType === 'rightTriangle') {
                    // 右耳标记
                    ctx.beginPath();
                    ctx.moveTo(150, 90);
                    ctx.lineTo(190, 30);
                    ctx.lineTo(230, 90);
                    ctx.closePath();
                    ctx.stroke();
                } else if (scan.markType === 'petals') {
                    // 花瓣标记 - 画多个小圆
                    const petalAngles = [0, 72, 144, 216, 288]; // 5个方向
                    for (let i = 0; i < features.petalCount && i < 5; i++) {
                        const angle = petalAngles[i] * Math.PI / 180;
                        const px = 140 + Math.cos(angle) * 70;
                        const py = 120 + Math.sin(angle) * 70;
                        ctx.beginPath();
                        ctx.arc(px, py, 25, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                } else if (scan.markType === 'circle') {
                    // 中心圆形标记
                    ctx.beginPath();
                    ctx.arc(140, 130, 50, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (scan.markType === 'line') {
                    // 花茎标记
                    ctx.beginPath();
                    ctx.moveTo(140, 180);
                    ctx.lineTo(140, 260);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            }
            
            await this.delay(1000);
            bubble.style.opacity = '0';
        }

        magnifier.style.opacity = '0';
        
        // 保存特征分析结果和池化结果
        this.lastAnalyzedFeatures = features;
        return poolResults;
    }
    
    // 简单特征分析（基于池化结果）
    analyzeFeatures(poolResults) {
        const edge = poolResults['edge'];
        const vert = poolResults['vertical'];
        const size = edge.length; // 13x13
        const mid = Math.floor(size / 2);
        
        // ===== 猫耳朵检测（顶部“两峰值”，更不怕左右偏移）=====
        // 思路：耳朵会在顶部形成两个明显“尖峰”。注意：标准小猫的“圆脸边线”可能会让中间不够空，
        // 所以这里对“中间必须很空”的要求要更宽松，否则会出现“只找到一只耳朵”的情况。
        const topRows = Math.max(2, Math.floor(size * 0.28)); // 顶部窗口（稍微更靠上，减少圆脸边线干扰）
        const colSums = Array(size).fill(0);
        for (let y = 0; y < topRows; y++) {
            for (let x = 0; x < size; x++) {
                colSums[x] += edge[y][x];
            }
        }
        const colAvg = colSums.map(v => v / topRows); // 0-1附近

        // 轻微平滑，减少噪声
        const smooth = colAvg.map((_, i) => {
            const a = colAvg[Math.max(0, i - 1)];
            const b = colAvg[i];
            const c = colAvg[Math.min(size - 1, i + 1)];
            return (a + b + c) / 3;
        });

        const meanTop = smooth.reduce((acc, v) => acc + v, 0) / size;
        const sortedIdx = [...Array(size).keys()].sort((i, j) => smooth[j] - smooth[i]);
        const minSep = Math.max(3, Math.floor(size * 0.30));

        const p1 = sortedIdx[0];
        let p2 = null;
        for (let k = 1; k < sortedIdx.length; k++) {
            const cand = sortedIdx[k];
            if (Math.abs(cand - p1) >= minSep) { p2 = cand; break; }
        }

        let hasLeftEar = false;
        let hasRightEar = false;
        let leftEarScore = 0;
        let rightEarScore = 0;

        if (p2 !== null) {
            const leftX = Math.min(p1, p2);
            const rightX = Math.max(p1, p2);
            leftEarScore = smooth[leftX];
            rightEarScore = smooth[rightX];

            const separation = rightX - leftX;
            let gapAvg = 0;
            if (separation > 1) {
                let gapSum = 0;
                let gapCnt = 0;
                for (let x = leftX + 1; x < rightX; x++) {
                    gapSum += smooth[x];
                    gapCnt++;
                }
                gapAvg = gapCnt > 0 ? gapSum / gapCnt : 0;
            }

            // 峰值门槛：既要绝对强，也要相对强（对小猫更友好一点）
            const peakAbs = 0.18;
            const peakRel = meanTop * 1.6;
            const peakThreshold = Math.max(peakAbs, peakRel);

            const minPeak = Math.min(leftEarScore, rightEarScore);
            const gapRatioThreshold = 0.98; // 中间相对更空（放宽，避免标准猫被误判成“单耳”）

            const hasTwoEarsShape =
                separation >= minSep &&
                leftEarScore >= peakThreshold &&
                rightEarScore >= peakThreshold &&
                gapAvg <= minPeak * gapRatioThreshold;

            if (hasTwoEarsShape) {
                // 根据左右位置映射到“左耳/右耳”
                hasLeftEar = leftX < mid;
                hasRightEar = rightX > mid;
                // 若都落在同侧（极端偏移），也给它拆成两只耳朵用于展示
                if (!hasLeftEar && !hasRightEar) {
                    hasLeftEar = true;
                    hasRightEar = true;
                }
            } else {
                // 兜底1：分别在左半边/右半边找一个峰（不要求中间很空，解决“标准猫只找到一只耳朵”）
                let leftPeakX = 0, leftPeakV = -Infinity;
                for (let x = 0; x < mid; x++) {
                    if (smooth[x] > leftPeakV) { leftPeakV = smooth[x]; leftPeakX = x; }
                }
                let rightPeakX = mid + 1, rightPeakV = -Infinity;
                for (let x = mid + 1; x < size; x++) {
                    if (smooth[x] > rightPeakV) { rightPeakV = smooth[x]; rightPeakX = x; }
                }
                const sepLR = rightPeakX - leftPeakX;

                if (isFinite(leftPeakV) && isFinite(rightPeakV) && leftPeakV >= peakThreshold && rightPeakV >= peakThreshold && sepLR >= minSep) {
                    hasLeftEar = true;
                    hasRightEar = true;
                    leftEarScore = leftPeakV;
                    rightEarScore = rightPeakV;
                } else {
                    // 兜底2：单耳（特别强的单峰也算一只耳朵，但不作为“关键特征”）
                    const veryStrong = 0.30;
                    const peakX = p1;
                    const peakV = smooth[peakX];
                    if (peakV >= veryStrong) {
                        if (peakX <= mid) hasLeftEar = true;
                        if (peakX >= mid) hasRightEar = true;
                        // 记录分数
                        if (hasLeftEar) leftEarScore = peakV;
                        if (hasRightEar) rightEarScore = peakV;
                    }
                }
            }
        } else {
            // 只有一个明显峰值：按单耳处理
            const peakX = p1;
            const peakV = smooth[peakX];
            const veryStrong = 0.30;
            if (peakV >= veryStrong) {
                if (peakX <= mid) { hasLeftEar = true; leftEarScore = peakV; }
                if (peakX >= mid) { hasRightEar = true; rightEarScore = peakV; }
            }
        }

        // ===== 花瓣检测（多瓣“突起” vs 一整圈轮廓）=====
        // 关键思路：花瓣通常是“多处突起”，而猫脸轮廓更像“均匀一圈”。
        // 我们在一个环形区域里按角度分扇区，计算每个扇区的边缘强度：
        // - 如果强度分布有明显“峰值”（差异大），更像花瓣
        // - 如果分布很均匀（差异小），更像圆脸轮廓，不算花瓣

        const sectorCount = 12; // 12个方向
        const sectorSums = Array(sectorCount).fill(0);
        const cx = (size - 1) / 2;
        const cy = (size - 1) / 2;
        const rMin = size * 0.28;
        const rMax = size * 0.50;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const r = Math.sqrt(dx * dx + dy * dy);
                if (r >= rMin && r <= rMax) {
                    let a = Math.atan2(dy, dx); // [-pi, pi]
                    if (a < 0) a += Math.PI * 2; // [0, 2pi)
                    const idx = Math.min(sectorCount - 1, Math.floor((a / (Math.PI * 2)) * sectorCount));
                    sectorSums[idx] += edge[y][x];
                }
            }
        }

        const sumAll = sectorSums.reduce((acc, v) => acc + v, 0);
        const mean = sumAll / sectorCount;
        const max = Math.max(...sectorSums);
        const min = Math.min(...sectorSums);
        const peakedness = max / (mean + 1e-9);
        const contrast = (max - min) / (max + 1e-9);

        // 判定“花瓣扇区”：强度明显高于平均值
        // 注意：这里不要用“耳朵检测结果”去影响花瓣阈值，否则会出现
        // 花朵先被误判出耳朵 -> 阈值变严 -> 反而检测不到花瓣 -> UI显示很怪。
        const factor = 1.35;
        const absFloor = 0.6; // 绝对下限，避免噪声
        const petalCount = sectorSums.filter(v => v > mean * factor && v > absFloor).length;

        // 花瓣成立条件：
        // - 至少4个方向有“突起”
        // - 峰值明显（不是均匀一圈）
        // - 对比度够大
        const minPetals = 4;
        const minPeakedness = 1.55;
        const minContrast = 0.40;
        const hasPetals = petalCount >= minPetals && peakedness >= minPeakedness && contrast >= minContrast;

        // 花朵“多瓣”特征很明显时：不要再显示“猫耳朵”
        // 这样花朵示例不会出现“发现猫耳朵”的误导。
        if (hasPetals && petalCount >= 4) {
            hasLeftEar = false;
            hasRightEar = false;
        }

        // 两只耳朵都有才算“猫耳朵”关键特征
        const earCount = (hasLeftEar ? 1 : 0) + (hasRightEar ? 1 : 0);
        const hasEars = earCount === 2;
        
        // ===== 中心圆形检测（脸或花蕊）=====
        let centerScore = 0;
        for (let y = mid - 3; y < mid + 3; y++) {
            for (let x = mid - 3; x < mid + 3; x++) {
                if (y >= 0 && y < size && x >= 0 && x < size) {
                    centerScore += edge[y][x];
                }
            }
        }
        const hasRoundShape = centerScore > 5;

        // ===== 花茎检测（长 + 大致垂直 + 在下半部，允许轻微弯曲）=====
        // 关键思路：花茎应该是“连续很多行”都出现的竖向线索，而不是短短一截（比如鼻子、嘴巴）。
        // 做法：
        // - 只看下半部
        // - 每一行在中心附近找最强的竖线响应（允许左右轻微漂移）
        // - 计算“最长连续命中长度”和“横向漂移范围”
        const bottomStart = Math.floor(size * 0.55);
        const bandHalfWidth = 3; // 允许稍微歪/弯：在中心左右3格内找
        const rowHitThreshold = earCount === 2 ? 0.65 : 0.45; // 猫更容易误触发，抬高阈值

        let stemScore = 0;
        let hitRows = 0;
        let longestRun = 0;
        let currentRun = 0;
        const hitXs = [];

        for (let y = bottomStart; y < size; y++) {
            let best = -Infinity;
            let bestX = mid;
            for (let x = mid - bandHalfWidth; x <= mid + bandHalfWidth; x++) {
                if (x >= 0 && x < size) {
                    const v = vert[y][x];
                    if (v > best) {
                        best = v;
                        bestX = x;
                    }
                }
            }

            // 叠加强度（用于展示/调试），但判定更依赖“连续长度”
            if (isFinite(best) && best > 0) stemScore += best;

            const hit = best >= rowHitThreshold;
            if (hit) {
                hitRows++;
                hitXs.push(bestX);
                currentRun++;
                longestRun = Math.max(longestRun, currentRun);
            } else {
                currentRun = 0;
            }
        }

        // 计算“是否足够垂直”：命中行的横向漂移不能太大（允许一点弯）
        let drift = 0;
        if (hitXs.length >= 2) {
            const minX = Math.min(...hitXs);
            const maxX = Math.max(...hitXs);
            drift = maxX - minX;
        }

        const bottomLen = size - bottomStart;
        const minRun = earCount === 2 ? Math.ceil(bottomLen * 0.60) : Math.ceil(bottomLen * 0.45); // 需要足够“长”
        const minHits = earCount === 2 ? Math.ceil(bottomLen * 0.70) : Math.ceil(bottomLen * 0.50);
        const maxDrift = 2; // 允许左右最多漂移2格（弯但不乱跑）

        const hasStem = longestRun >= minRun && hitRows >= minHits && drift <= maxDrift;
        
        return { 
            hasEars, hasLeftEar, hasRightEar, earCount,
            hasPetals, petalCount,
            hasRoundShape, hasStem, 
            leftEarScore, rightEarScore, centerScore, stemScore,
            stemDebug: { hitRows, longestRun, drift, rowHitThreshold, bottomStart },
            petalDebug: { sectorSums, mean, max, min, peakedness, contrast }
        };
    }

    async showStep3(poolResults) {
        // 使用之前分析的特征
        const features = this.lastAnalyzedFeatures || { 
            hasEars: false, earCount: 0, hasLeftEar: false, hasRightEar: false,
            hasPetals: false, petalCount: 0,
            hasRoundShape: false, hasStem: false 
        };
        
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>🎒 步骤 3：AI小侦探收集到的线索</h3>
            <div class="step-description">
                <div class="detective-avatar">🤖</div>
                <strong>"让我整理一下找到的线索..."</strong>
            </div>
            <div class="clue-collection" id="clueCards" style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-top: 20px;">
            </div>
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(300);

        const container = document.getElementById('clueCards');
        
        // 线索卡片定义 - 更详细的特征
        const clueCards = [
            {
                id: 'ears',
                found: features.earCount > 0,
                icon: '🔺🔺',
                title: `猫耳朵 ×${features.earCount}`,
                desc: features.earCount === 2 ? '两只耳朵！一定是小猫！' : 
                      features.earCount === 1 ? '只找到一只耳朵...' : '没有发现耳朵',
                color: '#28a745',
                highlight: features.earCount === 2,
                count: features.earCount
            },
            {
                id: 'petals',
                found: features.hasPetals,
                icon: '🌸',
                title: `花瓣 ×${features.petalCount}`,
                desc: features.petalCount >= 4 ? '好多花瓣！一定是花朵！' :
                      features.petalCount > 0 ? `找到${features.petalCount}片花瓣` : '没有发现花瓣',
                color: '#e83e8c',
                highlight: features.petalCount >= 4,
                count: features.petalCount
            },
            {
                id: 'round',
                found: features.hasRoundShape,
                icon: '⭕',
                title: '圆形',
                desc: features.hasEars ? '猫咪的圆脸蛋' : '花朵的花蕊',
                color: '#667eea',
                highlight: false,
                count: features.hasRoundShape ? 1 : 0
            },
            {
                id: 'stem',
                found: features.hasStem,
                icon: '📏',
                title: '花茎',
                desc: '直直的茎！花朵特征！',
                color: '#17a2b8',
                highlight: features.hasStem,
                count: features.hasStem ? 1 : 0
            }
        ];

        for (let card of clueCards) {
            const cardEl = document.createElement('div');
            cardEl.style.cssText = `
                width: 130px;
                padding: 15px;
                border-radius: 15px;
                text-align: center;
                transition: all 0.5s ease;
                opacity: 0;
                transform: translateY(30px) scale(0.8);
            `;
            
            if (card.found) {
                // 高亮的特征卡片（猫耳朵×2 或 花瓣≥4）
                if (card.highlight) {
                    cardEl.style.background = `linear-gradient(135deg, ${card.color}20, ${card.color}40)`;
                    cardEl.style.border = `4px solid ${card.color}`;
                    cardEl.style.boxShadow = `0 8px 30px ${card.color}50`;
                    cardEl.style.transform = 'scale(1.05)';
                    cardEl.innerHTML = `
                        <div style="font-size: 2.5em; margin-bottom: 8px;">${card.icon}</div>
                        <div style="font-weight: bold; color: ${card.color}; font-size: 1.2em;">${card.title}</div>
                        <div style="font-size: 0.9em; color: white; background: ${card.color}; padding: 5px 10px; border-radius: 15px; margin-top: 8px;">
                            ⭐ 关键特征！
                    </div>
                        <div style="font-size: 0.75em; color: #333; margin-top: 8px;">${card.desc}</div>
                    `;
                } else {
                    cardEl.style.background = 'white';
                    cardEl.style.border = `3px solid ${card.color}`;
                    cardEl.style.boxShadow = `0 4px 15px ${card.color}30`;
                    cardEl.innerHTML = `
                        <div style="font-size: 2.5em; margin-bottom: 8px;">${card.icon}</div>
                        <div style="font-weight: bold; color: #333; font-size: 1em;">${card.title}</div>
                        <div style="font-size: 0.8em; color: ${card.color}; margin-top: 8px;">✅ 找到了</div>
                        <div style="font-size: 0.7em; color: #666; margin-top: 5px;">${card.desc}</div>
                    `;
                }
            } else {
                cardEl.style.background = '#f8f8f8';
                cardEl.style.border = '2px dashed #ddd';
                cardEl.innerHTML = `
                    <div style="font-size: 2.5em; margin-bottom: 8px; filter: grayscale(100%); opacity: 0.3;">${card.icon}</div>
                    <div style="font-weight: bold; color: #bbb; font-size: 1em;">${card.title}</div>
                    <div style="font-size: 0.8em; color: #bbb; margin-top: 8px;">❌ 没找到</div>
            `;
            }
            
            container.appendChild(cardEl);

            // 动画显示
            await this.delay(100);
            cardEl.style.opacity = '1';
            if (!card.highlight) {
                cardEl.style.transform = 'translateY(0) scale(1)';
            }
            await this.delay(300);
        }

        // 总结 - 突出关键发现
        const hasKeyEarFeature = features.earCount === 2;
        const hasKeyPetalFeature = features.petalCount >= 4;
        
        let summaryText = '';
        let summaryColor = '#667eea';
        
        if (hasKeyEarFeature && !hasKeyPetalFeature) {
            summaryText = `我发现了 <strong style="color: #28a745;">2只尖尖的耳朵</strong>！这是小猫的关键特征！`;
            summaryColor = '#28a745';
        } else if (hasKeyPetalFeature && !hasKeyEarFeature) {
            summaryText = `我发现了 <strong style="color: #e83e8c;">${features.petalCount}片花瓣</strong>！这是花朵的关键特征！`;
            summaryColor = '#e83e8c';
        } else if (hasKeyEarFeature && hasKeyPetalFeature) {
            summaryText = `找到了耳朵也找到了花瓣...让我仔细想想！`;
        } else {
            const foundCount = clueCards.filter(c => c.found).length;
            summaryText = `我找到了 ${foundCount} 条线索，让我对比一下档案！`;
        }
        
        const summaryEl = document.createElement('div');
        summaryEl.style.cssText = `
            width: 100%;
            margin-top: 20px;
            padding: 18px;
            background: linear-gradient(135deg, ${summaryColor}15, ${summaryColor}25);
            border: 2px solid ${summaryColor}50;
            border-radius: 15px;
            text-align: center;
            font-size: 1.15em;
            opacity: 0;
            transition: opacity 0.5s;
        `;
        summaryEl.innerHTML = `
            <div class="detective-avatar" style="font-size: 1.5em; margin-bottom: 8px;">🤖</div>
            <div>${summaryText}</div>
        `;
        container.appendChild(summaryEl);
        
        await this.delay(300);
        summaryEl.style.opacity = '1';

        return poolResults;
    }

    async showStep4(originalMatrix, poolResults) {
        const features = this.lastAnalyzedFeatures || { hasEars: false, hasRoundShape: false, hasStem: false };

        // 检查是否使用训练模式
        const trainingSamples = this.trainingManager.getSamples();
        const useTraining = trainingSamples.length >= 2;

        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `
            <h3>📋 步骤 4：对比档案，找出答案！</h3>
            <div class="step-description">
                <div class="detective-avatar">🤖</div>
                <strong>"让我对比一下档案库..."</strong>
            </div>
            <div id="archiveComparison" style="margin-top: 20px;"></div>
            ${useTraining ? '<div id="matchingAnimation" class="matching-animation"></div>' : ''}
        `;
        this.stepsContainer.appendChild(step);

        await this.delay(300);
        
        const comparisonContainer = document.getElementById('archiveComparison');
        
        if (!useTraining) {
            // 显示档案对比（非训练模式）- 突出关键特征
            const earScore = features.earCount === 2 ? 3 : features.earCount === 1 ? 1 : 0;  // 两只耳朵得3分
            const petalScore = features.petalCount >= 4 ? 3 : features.petalCount >= 2 ? 1 : 0;  // 多花瓣得3分
            
            const catMatch = earScore + (features.hasRoundShape ? 1 : 0) + (!features.hasStem ? 1 : 0);
            const flowerMatch = petalScore + (features.hasStem ? 2 : 0) + (features.hasRoundShape ? 0.5 : 0);
            
            const catPercent = Math.min(100, Math.round(catMatch / 5 * 100));
            const flowerPercent = Math.min(100, Math.round(flowerMatch / 5.5 * 100));
            
            comparisonContainer.innerHTML = `
                <div style="display: flex; justify-content: center; gap: 25px; flex-wrap: wrap;">
                    <!-- 小猫档案 -->
                    <div class="archive-card cat-card" style="width: 220px; padding: 20px; opacity: 0; transform: translateX(-30px); transition: all 0.5s; ${catPercent > flowerPercent ? 'box-shadow: 0 0 30px #28a74550;' : ''}" id="catArchive">
                        <div class="archive-icon" style="font-size: 3.5em;">🐱</div>
                        <div class="archive-title" style="font-size: 1.2em; margin: 10px 0;">小猫档案</div>
                        <div style="text-align: left; margin-top: 12px; font-size: 0.95em;">
                            <div style="padding: 10px; margin: 6px 0; border-radius: 10px; background: ${features.earCount === 2 ? 'linear-gradient(135deg, #d4edda, #c3e6cb)' : features.earCount === 1 ? '#fff3cd' : '#f8f9fa'}; ${features.earCount === 2 ? 'border: 2px solid #28a745;' : ''}">
                                ${features.earCount === 2 ? '⭐' : features.earCount === 1 ? '🔸' : '❌'} 
                                <strong>尖耳朵 ×${features.earCount}</strong>
                                ${features.earCount === 2 ? '<span style="color: #28a745; font-size: 0.85em;"> (关键!)</span>' : ''}
                            </div>
                            <div style="padding: 10px; margin: 6px 0; border-radius: 10px; background: ${features.hasRoundShape ? '#d4edda' : '#f8f9fa'};">
                                ${features.hasRoundShape ? '✅' : '❌'} 圆圆的脸
                            </div>
                            <div style="padding: 10px; margin: 6px 0; border-radius: 10px; background: ${!features.hasStem ? '#d4edda' : '#f8f9fa'};">
                                ${!features.hasStem ? '✅' : '❌'} 没有花茎
                            </div>
                        </div>
                        <div style="margin-top: 15px; padding: 12px; background: ${catPercent > flowerPercent ? 'linear-gradient(135deg, #28a745, #20c997)' : 'linear-gradient(135deg, #667eea, #764ba2)'}; color: white; border-radius: 12px; font-weight: bold; font-size: 1.1em;">
                            匹配度: ${catPercent}%
                        </div>
                    </div>
                    
                    <!-- VS -->
                    <div style="display: flex; align-items: center; font-size: 2em; color: #999;" id="vsText">VS</div>
                    
                    <!-- 花朵档案 -->
                    <div class="archive-card flower-card" style="width: 220px; padding: 20px; opacity: 0; transform: translateX(30px); transition: all 0.5s; ${flowerPercent > catPercent ? 'box-shadow: 0 0 30px #e83e8c50;' : ''}" id="flowerArchive">
                        <div class="archive-icon" style="font-size: 3.5em;">🌸</div>
                        <div class="archive-title" style="font-size: 1.2em; margin: 10px 0;">花朵档案</div>
                        <div style="text-align: left; margin-top: 12px; font-size: 0.95em;">
                            <div style="padding: 10px; margin: 6px 0; border-radius: 10px; background: ${features.petalCount >= 4 ? 'linear-gradient(135deg, #f8d7da, #f5c6cb)' : features.petalCount > 0 ? '#fff3cd' : '#f8f9fa'}; ${features.petalCount >= 4 ? 'border: 2px solid #e83e8c;' : ''}">
                                ${features.petalCount >= 4 ? '⭐' : features.petalCount > 0 ? '🔸' : '❌'} 
                                <strong>花瓣 ×${features.petalCount}</strong>
                                ${features.petalCount >= 4 ? '<span style="color: #e83e8c; font-size: 0.85em;"> (关键!)</span>' : ''}
                            </div>
                            <div style="padding: 10px; margin: 6px 0; border-radius: 10px; background: ${features.hasStem ? '#d4edda' : '#f8f9fa'}; ${features.hasStem ? 'border: 2px solid #17a2b8;' : ''}">
                                ${features.hasStem ? '⭐' : '❌'} <strong>直直的花茎</strong>
                                ${features.hasStem ? '<span style="color: #17a2b8; font-size: 0.85em;"> (关键!)</span>' : ''}
                            </div>
                            <div style="padding: 10px; margin: 6px 0; border-radius: 10px; background: ${!features.hasEars ? '#d4edda' : '#f8f9fa'};">
                                ${!features.hasEars ? '✅' : '❌'} 没有耳朵
                            </div>
                        </div>
                        <div style="margin-top: 15px; padding: 12px; background: ${flowerPercent > catPercent ? 'linear-gradient(135deg, #e83e8c, #c71585)' : 'linear-gradient(135deg, #ff69b4, #ff1493)'}; color: white; border-radius: 12px; font-weight: bold; font-size: 1.1em;">
                            匹配度: ${flowerPercent}%
                        </div>
                    </div>
                </div>
            `;
            
            // 动画显示
            await this.delay(100);
            document.getElementById('catArchive').style.opacity = '1';
            document.getElementById('catArchive').style.transform = 'translateX(0)';
            await this.delay(300);
            document.getElementById('flowerArchive').style.opacity = '1';
            document.getElementById('flowerArchive').style.transform = 'translateX(0)';
        }

        await this.delay(500);

        // 如果使用训练模式，显示简化的匹配动画
        if (useTraining) {
            await this.showSimpleMatchingAnimation(poolResults);
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

    // 简化的匹配动画（适合小朋友看）
    async showSimpleMatchingAnimation(poolResults) {
        const container = document.getElementById('matchingAnimation');
        if (!container) return;

        const samples = this.trainingManager.getSamples();
        const currentFeatures = KNNClassifier.extractRegionalFeatures(poolResults);
        const maxDist = KNNClassifier.maxWeightedDistance();

        container.innerHTML = `
            <div style="padding: 20px; background: white; border-radius: 15px; margin-top: 15px; border: 3px solid #667eea; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div class="detective-avatar" style="font-size: 2em;">🤖</div>
                    <div style="font-size: 1.1em; color: #333; font-weight: 600;">
                        "让我在档案库里找找最像的..."
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin: 20px 0;">
                    <div style="text-align: center;">
                        <canvas id="currentImg" width="100" height="100" style="border: 3px solid #667eea; border-radius: 10px;"></canvas>
                        <div style="margin-top: 5px; font-size: 14px; color: #666;">你的画</div>
                    </div>
                    <div style="font-size: 2em; color: #667eea;">🔍</div>
                    <div id="samplesList" style="display: flex; gap: 10px; flex-wrap: wrap; max-width: 300px;"></div>
                </div>
                
                <div id="matchResult" style="text-align: center; margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 10px; opacity: 0; transition: opacity 0.5s;"></div>
            </div>
        `;

        // 绘制当前图像
        const currentCanvas = document.getElementById('currentImg');
        const currentCtx = currentCanvas.getContext('2d');
        const rawImageData = this.drawingBoard.getImageData();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = rawImageData.width;
        tempCanvas.height = rawImageData.height;
        tempCanvas.getContext('2d').putImageData(rawImageData, 0, 0);
        currentCtx.fillStyle = 'white';
        currentCtx.fillRect(0, 0, 100, 100);
        currentCtx.drawImage(tempCanvas, 0, 0, 100, 100);

        const samplesList = document.getElementById('samplesList');
        let bestMatch = null;
        let bestSimilarity = 0;

        // 逐个显示样本并计算相似度
        for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            const distance = KNNClassifier.weightedDistance(currentFeatures, sample.features);
            const similarity = KNNClassifier.distanceToSimilarity(distance, maxDist);

            const sampleDiv = document.createElement('div');
            sampleDiv.style.cssText = `text-align: center; opacity: 0; transform: scale(0.8); transition: all 0.3s;`;
            
            const canvas = document.createElement('canvas');
            canvas.width = 60;
            canvas.height = 60;
            canvas.style.cssText = `border: 3px solid ${similarity > 70 ? '#28a745' : '#ddd'}; border-radius: 8px;`;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 60, 60);
            
            if (sample.imageData && typeof sample.imageData === 'object') {
                const temp = document.createElement('canvas');
                temp.width = sample.imageData.width;
                temp.height = sample.imageData.height;
                temp.getContext('2d').putImageData(sample.imageData, 0, 0);
                ctx.drawImage(temp, 0, 0, 60, 60);
            } else if (sample.imageDataURL) {
                const img = new Image();
                img.src = sample.imageDataURL;
                ctx.drawImage(img, 0, 0, 60, 60);
            }
            
            const label = document.createElement('div');
            label.style.cssText = `font-size: 12px; margin-top: 3px; color: ${similarity > 70 ? '#28a745' : '#666'};`;
            label.textContent = `${sample.label === 'cat' ? '🐱' : '🌸'} ${similarity.toFixed(0)}%`;
            
            sampleDiv.appendChild(canvas);
            sampleDiv.appendChild(label);
            samplesList.appendChild(sampleDiv);
            
            // 动画显示
            await this.delay(100);
            sampleDiv.style.opacity = '1';
            sampleDiv.style.transform = 'scale(1)';
            
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = { sample, similarity, index: i };
            }
            
            await this.delay(200);
        }

        // 显示结果
        const resultDiv = document.getElementById('matchResult');
        if (bestMatch) {
            const emoji = bestMatch.sample.label === 'cat' ? '🐱' : '🌸';
            const name = bestMatch.sample.label === 'cat' ? '小猫' : '花朵';
            resultDiv.innerHTML = `
                <div style="font-size: 1.2em; color: #28a745; font-weight: bold;">
                    ✅ 找到最像的档案！
                </div>
                <div style="font-size: 2em; margin: 10px 0;">${emoji}</div>
                <div style="font-size: 1.1em;">
                    和 <strong>${name}</strong> 的相似度最高：<strong style="color: #667eea;">${bestSimilarity.toFixed(0)}%</strong>
                </div>
            `;
        }
        resultDiv.style.opacity = '1';
        
        await this.delay(500);
    }

    // 显示匹配动画（完整版，保留但不使用）
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
            const distance = KNNClassifier.weightedDistanceByLabel(currentFeatures, sample.features, sample.label);
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
