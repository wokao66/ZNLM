// script.js

let canvas = null;
let zoomLevelEl = null;
let zoomInBtn = null;
let zoomOutBtn = null;
let resetBtn = null;

// 核心状态管理
const state = {
    scale: 1,
    panning: false,
    pointX: 0, // 画布当前 X 偏移
    pointY: 0, // 画布当前 Y 偏移
    startX: 0,
    startY: 0,
    // 手机端双指缩放变量
    startDistance: 0,
    startScale: 1
};

// 布局参数
const IMAGE_WIDTH = 150;
const GRID_GAP = 50; // 网格间距
const MAX_ATTEMPTS = 10; // 寻找空闲位置的最大尝试次数

document.addEventListener('DOMContentLoaded', () => {
    // 初始化 DOM 元素
    canvas = document.getElementById('canvas');
    zoomLevelEl = document.getElementById('zoomLevel');
    zoomInBtn = document.getElementById('zoomIn');
    zoomOutBtn = document.getElementById('zoomOut');
    resetBtn = document.getElementById('resetBtn');

    // 按钮绑定事件
    zoomInBtn.addEventListener('click', updateZoom.bind(null, 1.2));
    zoomOutBtn.addEventListener('click', updateZoom.bind(null, 0.8));
    resetBtn.addEventListener('click', resetView);

    // 启动核心逻辑
    initCanvas();
});

async function initCanvas() {
    try {
        const response = await fetch('data.json');
        const images = await response.json();
        
        // 移除加载提示
        const loading = document.getElementById('loading');
        if (loading) loading.remove();

        // 将图片均匀摆放在画布上
        distributeImages(images);

        // 绑定 PC 和 移动端 的手势交互
        bindInteractions();
        
    } catch (error) {
        console.error('初始化失败:', error);
    }
}

// --- 布局算法：网格对齐 + 随机微偏移 ---
function distributeImages(filenames) {
    if (filenames.length === 0) return;

    // 1. 计算每张图片的虚拟网格中心点
    let gridX = 0;
    let gridY = 0;
    const cellSize = IMAGE_WIDTH + GRID_GAP;
    const totalWidth = Math.ceil(Math.sqrt(filenames.length)) * cellSize;
    const initialPoints = [];

    for (let i = 0; i < filenames.length; i++) {
        initialPoints.push({ x: gridX, y: gridY });
        gridX += cellSize;
        if (gridX > totalWidth) {
            gridX = 0;
            gridY += cellSize;
        }
    }

    // 2. 创建画布中的 DOM 元素
    filenames.forEach((filename, index) => {
        if (!filename) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';
        
        const img = document.createElement('img');
        img.src = `images/${filename}`;
        img.alt = 'Gallery Image';
        img.loading = 'lazy'; // 懒加载优化性能

        // 添加轻微随机角度，增加自然感
        const randomRotation = (Math.random() - 0.5) * 6; 
        wrapper.style.transform = `rotate(${randomRotation}deg)`;

        wrapper.appendChild(img);
        canvas.appendChild(wrapper);

        // 3. 分配位置
        const { x, y } = initialPoints[index] || { x: 0, y: 0 };
        wrapper.style.left = `${x}px`;
        wrapper.style.top = `${y}px`;
    });

    // 居中初始视图
    resetView();
}

// --- 视图控制 ---
function updateZoom(changeFactor) {
    state.scale *= changeFactor;
    state.scale = Math.max(0.2, Math.min(state.scale, 3)); // 限制缩放范围
    updateTransform();
}

function resetView() {
    state.scale = 1;
    // 居中画布：让屏幕中心对准画布中心
    state.pointX = window.innerWidth / 2 - (IMAGE_WIDTH + GRID_GAP) * Math.ceil(Math.sqrt(270)) / 2;
    state.pointY = window.innerHeight / 2 - (IMAGE_WIDTH + GRID_GAP) * Math.ceil(Math.sqrt(270)) / 4;
    updateTransform();
}

function updateTransform() {
    canvas.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
    zoomLevelEl.innerText = `${Math.round(state.scale * 100)}%`;
}

// --- 核心交互逻辑：兼容 PC 鼠标与手机触摸 ---
function bindInteractions() {
    // ========== PC 鼠标拖拽 ==========
    window.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return; // 允许点击按钮
        state.panning = true;
        state.startX = e.clientX - state.pointX;
        state.startY = e.clientY - state.pointY;
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!state.panning) return;
        e.preventDefault();
        state.pointX = e.clientX - state.startX;
        state.pointY = e.clientY - state.startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        state.panning = false;
        canvas.style.cursor = 'grab';
    });

    // ========== 手机端 触摸手势 ==========
    window.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'BUTTON') return;

        if (e.touches.length === 1) {
            // 单指滑动：平移画布
            state.panning = true;
            state.startX = e.touches[0].clientX - state.pointX;
            state.startY = e.touches[0].clientY - state.pointY;
        } else if (e.touches.length === 2) {
            // 双指接触：准备缩放
            state.panning = false;
            state.startDistance = getTouchDistance(e.touches[0], e.touches[1]);
            state.startScale = state.scale;
        }
    }, { passive: false }); // passive: false 允许我们阻止默认滚动

    window.addEventListener('touchmove', (e) => {
        if (state.panning && e.touches.length === 1) {
            e.preventDefault(); // 阻止页面整体滚动
            state.pointX = e.touches[0].clientX - state.startX;
            state.pointY = e.touches[0].clientY - state.startY;
            updateTransform();
        } else if (e.touches.length === 2) {
            // 双指移动：实时缩放
            e.preventDefault();
            const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
            const delta = currentDistance / state.startDistance;
            
            state.scale = state.startScale * delta;
            state.scale = Math.max(0.2, Math.min(state.scale, 3));
            updateTransform();
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        state.panning = false;
    });
}

// 辅助：计算两点之间的距离（用于双指缩放）
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}