document.addEventListener('DOMContentLoaded', () => {
  const
    STATE = {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      isDragging: false,
      lastDragPosition: { x: 0, y: 0 },
      initialPinchDistance: null,
    },
    CONFIG = {
      MIN_ZOOM: 0.1,
      MAX_ZOOM: 20,
      ZOOM_SENSITIVITY: 0.001,
    };

  const
    appContainer = document.getElementById('app-container'),
    imageViewer = document.getElementById('image-viewer'),
    imageContainer = document.getElementById('image-container'),
    mainImage = document.getElementById('main-image'),
    uiControls = document.getElementById('ui-controls'),
    zoomDisplay = document.getElementById('zoom-display'),
    resetBtn = document.getElementById('reset-btn'),
    fullscreenBtn = document.getElementById('fullscreen-btn'),
    loader = document.getElementById('loader'),
    errorContainer = document.getElementById('error-container'),
    errorMessage = document.getElementById('error-message');

  let hashUpdateTimeout;

  const getImageUrlFromPath = () => {
    try {
      // Skips the initial '/'
      const path = window.location.pathname.substring(1);
      if (!path) return null;
      return decodeURIComponent(path);
    } catch (e) {
      console.error('Error decoding URL path:', e);
      return null;
    }
  };

  const isValidHttpUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const isImageUrl = (url) => {
    return /\.(jpeg|jpg|gif|png|webp)$/i.test(url.split('?')[0]);
  };

  const showError = (message) => {
    loader.classList.add('hidden');
    imageViewer.classList.add('hidden');
    uiControls.classList.add('hidden');
    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
  };
  
  const applyTransform = (isInstant = false) => {
    const { zoom, offsetX, offsetY } = STATE;
    imageContainer.style.transition = isInstant ? 'none' : '';
    imageContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
    updateUrlHash();
  };
  
  const centerImage = () => {
    const { naturalWidth, naturalHeight } = mainImage;
    if (naturalWidth === 0 || naturalHeight === 0) return; // Avoid division by zero if image fails to load correctly

    const viewerWidth = imageViewer.clientWidth;
    const viewerHeight = imageViewer.clientHeight;

    // The image should fit within 75% of the viewport.
    const targetWidth = viewerWidth * 0.75;
    const targetHeight = viewerHeight * 0.75;

    // Calculate the scale required to fit the image into the target box.
    const scaleX = targetWidth / naturalWidth;
    const scaleY = targetHeight / naturalHeight;
    const fitScale = Math.min(scaleX, scaleY);
    
    // If the image is smaller than the target box, display it at its original size (zoom=1).
    // Otherwise, use the calculated scale to make it fit.
    const initialZoom = Math.min(1.0, fitScale);

    STATE.zoom = initialZoom;

    // Calculate the displayed dimensions.
    const displayedWidth = naturalWidth * initialZoom;
    const displayedHeight = naturalHeight * initialZoom;

    // Calculate offsets to center the image in the viewport.
    STATE.offsetX = (viewerWidth - displayedWidth) / 2;
    STATE.offsetY = (viewerHeight - displayedHeight) / 2;

    applyTransform(true);
  };
  
  const handleWheel = (e) => {
    e.preventDefault();

    const viewerRect = imageViewer.getBoundingClientRect();
    const mouseX = e.clientX - viewerRect.left;
    const mouseY = e.clientY - viewerRect.top;

    const zoomFactor = 1 - e.deltaY * CONFIG.ZOOM_SENSITIVITY;
    const newZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, STATE.zoom * zoomFactor));

    const worldMouseX = (mouseX - STATE.offsetX) / STATE.zoom;
    const worldMouseY = (mouseY - STATE.offsetY) / STATE.zoom;

    STATE.offsetX = mouseX - worldMouseX * newZoom;
    STATE.offsetY = mouseY - worldMouseY * newZoom;
    STATE.zoom = newZoom;

    applyTransform();
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    STATE.isDragging = true;
    STATE.lastDragPosition = { x: e.clientX, y: e.clientY };
    imageViewer.style.cursor = 'grabbing';
  };
  
  const handleMouseMove = (e) => {
    if (!STATE.isDragging) return;
    e.preventDefault();
    const dx = e.clientX - STATE.lastDragPosition.x;
    const dy = e.clientY - STATE.lastDragPosition.y;
    STATE.offsetX += dx;
    STATE.offsetY += dy;
    STATE.lastDragPosition = { x: e.clientX, y: e.clientY };
    applyTransform();
  };
  
  const handleMouseUp = () => {
    STATE.isDragging = false;
    imageViewer.style.cursor = 'grab';
  };

  const getDistance = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const getMidpoint = (t1, t2) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const handleTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      STATE.isDragging = true;
      STATE.lastDragPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      STATE.isDragging = false;
      STATE.initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && STATE.isDragging) {
      const dx = e.touches[0].clientX - STATE.lastDragPosition.x;
      const dy = e.touches[0].clientY - STATE.lastDragPosition.y;
      STATE.offsetX += dx;
      STATE.offsetY += dy;
      STATE.lastDragPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      applyTransform();
    } else if (e.touches.length === 2 && STATE.initialPinchDistance) {
      const newDist = getDistance(e.touches[0], e.touches[1]);
      const zoomFactor = newDist / STATE.initialPinchDistance;
      const newZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, STATE.zoom * zoomFactor));
      
      const midpoint = getMidpoint(e.touches[0], e.touches[1]);
      const viewerRect = imageViewer.getBoundingClientRect();
      const mouseX = midpoint.x - viewerRect.left;
      const mouseY = midpoint.y - viewerRect.top;

      const worldMouseX = (mouseX - STATE.offsetX) / STATE.zoom;
      const worldMouseY = (mouseY - STATE.offsetY) / STATE.zoom;

      STATE.offsetX = mouseX - worldMouseX * newZoom;
      STATE.offsetY = mouseY - worldMouseY * newZoom;
      STATE.zoom = newZoom;
      STATE.initialPinchDistance = newDist;

      applyTransform();
    }
  };

  const handleTouchEnd = () => {
    STATE.isDragging = false;
    STATE.initialPinchDistance = null;
  };

  const resetView = () => {
    centerImage();
    window.history.replaceState(null, '', window.location.pathname);
  };
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      appContainer.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const updateUrlHash = () => {
    clearTimeout(hashUpdateTimeout);
    hashUpdateTimeout = setTimeout(() => {
      const { zoom, offsetX, offsetY } = STATE;
      const hash = `#z=${zoom.toFixed(2)}&x=${Math.round(offsetX)}&y=${Math.round(offsetY)}`;
      // Use replaceState to avoid polluting browser history
      window.history.replaceState(null, '', hash);
    }, 250);
  };
  
  const parseUrlHash = () => {
    try {
      const hash = new URLSearchParams(window.location.hash.substring(1));
      const z = parseFloat(hash.get('z'));
      const x = parseInt(hash.get('x'), 10);
      const y = parseInt(hash.get('y'), 10);

      if (!isNaN(z) && !isNaN(x) && !isNaN(y)) {
        STATE.zoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, z));
        STATE.offsetX = x;
        STATE.offsetY = y;
        return true;
      }
    } catch (e) {
      console.warn('Could not parse URL hash', e);
    }
    return false;
  };

  const init = () => {
    const imageUrl = getImageUrlFromPath();
    if (!imageUrl || !isValidHttpUrl(imageUrl)) {
      showError('Invalid or missing image URL in the path.');
      return;
    }
    if (!isImageUrl(imageUrl)) {
      showError('URL does not appear to point to a valid image file (jpeg, png, gif, webp).');
      return;
    }

    loader.classList.remove('hidden');

    mainImage.onload = () => {
      loader.classList.add('hidden');
      imageViewer.classList.remove('hidden');
      uiControls.classList.remove('hidden');
      
      const hasHash = parseUrlHash();
      if (hasHash) {
          applyTransform(true);
      } else {
          centerImage();
      }

      // Setup Listeners
      imageViewer.addEventListener('wheel', handleWheel, { passive: false });
      imageViewer.addEventListener('mousedown', handleMouseDown);
      imageViewer.addEventListener('mousemove', handleMouseMove);
      imageViewer.addEventListener('mouseup', handleMouseUp);
      imageViewer.addEventListener('mouseleave', handleMouseUp);
      
      imageViewer.addEventListener('touchstart', handleTouchStart, { passive: false });
      imageViewer.addEventListener('touchmove', handleTouchMove, { passive: false });
      imageViewer.addEventListener('touchend', handleTouchEnd);
      imageViewer.addEventListener('touchcancel', handleTouchEnd);

      resetBtn.addEventListener('click', resetView);
      fullscreenBtn.addEventListener('click', toggleFullscreen);
      window.addEventListener('resize', () => {
        // Simple resize handling: re-center if not zoomed
        if(STATE.zoom <= 1) resetView();
      });
    };

    mainImage.onerror = () => {
      showError('Failed to load the image. It may be private, moved, or not a valid image file.');
    };

    mainImage.src = imageUrl;
  };

  init();
});