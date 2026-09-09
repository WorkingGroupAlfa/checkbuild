const SEEK_TOLERANCE = 0.025;

/** Prime the decoder, then serialize seeks to the latest scroll position. */
export function attachScrollVideo(story: HTMLElement, video: HTMLVideoElement) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = video.parentElement;
  let animationFrame = 0;
  let videoFrame = 0;
  let disposed = false;
  let primed = false;
  let priming = false;
  let playAttempt = 0;
  let attemptedWhileVisible = false;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  const isVisible = () => {
    const bounds = story.getBoundingClientRect();
    return !document.hidden && bounds.bottom > 0 && bounds.top < window.innerHeight;
  };

  const update = () => {
    animationFrame = 0;
    if (disposed || motion.matches || !primed || !isVisible()) return;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || video.readyState < 2 || video.seeking) return;

    video.dataset.ready = 'true';
    // Match the sticky 100svh layer, not Safari's changing browser-toolbar height.
    const range = Math.max(1, story.offsetHeight - (viewport?.clientHeight || window.innerHeight));
    const progress = Math.max(0, Math.min(1, -story.getBoundingClientRect().top / range));
    const targetTime = progress * Math.max(0, duration - 0.035);
    if (Math.abs(video.currentTime - targetTime) <= SEEK_TOLERANCE) return;
    try {
      video.currentTime = targetTime;
    } catch {
      // The seekable range can disappear while Safari restores a suspended tab.
      // Media readiness events or the next gesture will retry the latest position.
    }
  };

  const scheduleUpdate = () => {
    if (!disposed && !animationFrame) animationFrame = window.requestAnimationFrame(update);
  };

  const cancelVideoFrame = () => {
    if (videoFrame) video.cancelVideoFrameCallback(videoFrame);
    videoFrame = 0;
  };

  const prime = (fromGesture = false) => {
    if (disposed || primed || motion.matches || video.error || !isVisible()) return;
    if (priming && !fromGesture) return;
    priming = true;
    attemptedWhileVisible = true;
    const attempt = ++playAttempt;
    cancelVideoFrame();
    let playing = false;
    let frameAvailable = typeof video.requestVideoFrameCallback !== 'function';
    const finishPrime = () => {
      if (disposed || attempt !== playAttempt || !playing || !frameAvailable) return;
      priming = false;
      primed = true;
      video.pause();
      scheduleUpdate();
    };
    if (!frameAvailable) {
      // Wait for a frame submitted by the decoder, not just metadata or a play
      // promise. Safari can otherwise expose an empty native video surface.
      videoFrame = video.requestVideoFrameCallback(() => {
        if (disposed || attempt !== playAttempt) return;
        videoFrame = 0;
        frameAvailable = true;
        finishPrime();
      });
    }
    // Call play synchronously inside the gesture handler: deferring it to a frame
    // or a media event loses user activation on iOS. Muted inline playback is brief.
    try {
      void video.play().then(() => {
        playing = true;
        finishPrime();
      }).catch(() => {
        if (disposed || attempt !== playAttempt) return;
        priming = false;
        cancelVideoFrame();
        // Keep the poster on autoplay denial and retry on a real touch/click.
      });
    } catch {
      priming = false;
      cancelVideoFrame();
    }
  };

  const onGesture = () => {
    prime(true);
    scheduleUpdate();
  };
  const onScroll = () => {
    // A restored page can start below the story; initialize when it becomes visible.
    // An autoplay denial is retried by onGesture, not on every scroll event.
    if (!attemptedWhileVisible) prime();
    scheduleUpdate();
  };
  const suspend = () => {
    ++playAttempt;
    cancelVideoFrame();
    attemptedWhileVisible = false;
    priming = false;
    primed = false;
    video.pause();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };
  const resume = () => {
    prime();
    scheduleUpdate();
  };
  const onVisibility = () => {
    if (document.hidden) suspend();
    else resume();
  };
  const onMotionChange = () => {
    if (motion.matches) {
      suspend();
      delete video.dataset.ready;
    } else {
      resume();
    }
  };
  const onError = () => {
    suspend();
    delete video.dataset.ready;
  };

  const mediaEvents = ['loadedmetadata', 'loadeddata', 'canplay', 'progress', 'seeked', 'durationchange'];
  const gestureEvents = ['touchend', 'click', 'keydown'];
  for (const event of mediaEvents) video.addEventListener(event, scheduleUpdate);
  for (const event of gestureEvents) window.addEventListener(event, onGesture, { passive: true });
  video.addEventListener('error', onError, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', onMotionChange);
  const resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(story);
  if (viewport) resizeObserver.observe(viewport);
  prime();

  return () => {
    disposed = true;
    suspend();
    delete video.dataset.ready;
    resizeObserver.disconnect();
    for (const event of mediaEvents) video.removeEventListener(event, scheduleUpdate);
    for (const event of gestureEvents) window.removeEventListener(event, onGesture);
    video.removeEventListener('error', onError, true);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', scheduleUpdate);
    window.removeEventListener('pagehide', suspend);
    window.removeEventListener('pageshow', resume);
    document.removeEventListener('visibilitychange', onVisibility);
    motion.removeEventListener('change', onMotionChange);
  };
}