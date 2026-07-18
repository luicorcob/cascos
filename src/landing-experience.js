const FRAME_COUNT = 90;
const MOBILE_BREAKPOINT = 899;
const LANDING_TRIGGER_PREFIX = "dls-landing-";
const ENHANCEMENT_CLASSES = [
  "has-motion",
  "is-motion-ready",
  "is-motion-reduced",
  "is-motion-fallback",
  "is-low-hardware",
  "has-webgl",
  "is-webgl-fallback",
  "has-custom-cursor",
  "uses-story-fallback"
];

window.DLSLanding?.destroy?.();

let destroyed = false;
let initialized = false;
let root = null;
const cleanups = [];

window.DLSLanding = {
  destroy
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
  cleanups.push(() => document.removeEventListener("DOMContentLoaded", init));
} else {
  init();
}

function init() {
  if (destroyed || initialized) return;

  root = document.querySelector("#dlsLanding");
  const wrapper = root?.querySelector(".dls-landing-scroll");
  const content = root?.querySelector(".dls-landing-content");
  if (!root || !wrapper || !content) return;

  initialized = true;

  const header = root.querySelector("[data-landing-header]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowHardware = detectLowHardware();
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const SplitText = window.SplitText;

  root.classList.toggle("is-low-hardware", lowHardware);
  addCleanup(setupHeader(header, wrapper));

  if (reducedMotion || !gsap || !ScrollTrigger) {
    root.classList.add(reducedMotion ? "is-motion-reduced" : "is-motion-fallback");
    root.classList.add("is-webgl-fallback", "uses-story-fallback");
    addCleanup(applyAccessibleFallback(root));
    addCleanup(setupAnchorNavigation(root, wrapper, header, null, true));
    return;
  }

  try {
    const plugins = SplitText ? [ScrollTrigger, SplitText] : [ScrollTrigger];
    gsap.registerPlugin(...plugins);
    root.classList.add("has-motion");

    const lenis = setupLenis(wrapper, content, gsap, ScrollTrigger);
    addCleanup(lenis.cleanup);
    addCleanup(setupAnchorNavigation(root, wrapper, header, lenis.instance, false));
    addCleanup(setupHeroTitle(root, gsap, SplitText));
    addCleanup(setupReveals(root, wrapper, gsap));
    addCleanup(setupTimeline(root, wrapper, gsap));
    addCleanup(setupCounters(root, wrapper, gsap, ScrollTrigger));
    addCleanup(setupPageWipe(root, gsap));

    const responsive = gsap.matchMedia();
    responsive.add(
      {
        desktop: `(min-width: ${MOBILE_BREAKPOINT + 1}px)`,
        mobile: `(max-width: ${MOBILE_BREAKPOINT}px)`
      },
      (context) => {
        const desktop = Boolean(context.conditions?.desktop);
        const useHeavyExperience = desktop && !lowHardware;
        const branchCleanups = [];

        root.classList.toggle("uses-story-fallback", !useHeavyExperience);
        root.classList.toggle("is-webgl-fallback", !useHeavyExperience);

        if (useHeavyExperience) {
          branchCleanups.push(setupAurora(root));
          branchCleanups.push(setupStorySequence(root, wrapper, gsap, ScrollTrigger));
          branchCleanups.push(setupHorizontalServices(root, wrapper, gsap, ScrollTrigger));
        } else {
          branchCleanups.push(setupStoryFallback(root, wrapper, gsap));
          branchCleanups.push(resetHorizontalServices(root, gsap));
        }

        return () => runCleanups(branchCleanups);
      }
    );
    addCleanup(() => responsive.revert());

    const pointerMedia = gsap.matchMedia();
    pointerMedia.add(
      `(min-width: ${MOBILE_BREAKPOINT + 1}px) and (hover: hover) and (pointer: fine)`,
      () => {
      if (lowHardware) return undefined;
      const pointerCleanups = [
        setupCursor(root, gsap),
        setupMagneticButtons(root, gsap),
        setupServiceTilt(root, gsap)
      ];
      return () => runCleanups(pointerCleanups);
      }
    );
    addCleanup(() => pointerMedia.revert());

    const readyFrame = window.requestAnimationFrame(() => {
      if (destroyed) return;
      root.classList.add("is-motion-ready");
      ScrollTrigger.refresh();
    });
    addCleanup(() => window.cancelAnimationFrame(readyFrame));
  } catch (error) {
    console.warn("[DLS Landing] No se pudieron iniciar todas las mejoras visuales.", error);
    runCleanups(cleanups.splice(0));
    ENHANCEMENT_CLASSES.forEach((className) => root.classList.remove(className));
    root.classList.add("is-motion-fallback", "is-webgl-fallback", "uses-story-fallback");
    addCleanup(setupHeader(header, wrapper));
    addCleanup(applyAccessibleFallback(root));
    addCleanup(setupAnchorNavigation(root, wrapper, header, null, true));
  }
}

function setupLenis(wrapper, content, gsap, ScrollTrigger) {
  const Lenis = window.Lenis;
  if (typeof Lenis !== "function") {
    root?.classList.add("is-motion-fallback");
    return { instance: null, cleanup: () => {} };
  }

  let lenis;
  try {
    lenis = new Lenis({
      wrapper,
      content,
      autoRaf: false,
      smoothWheel: true,
      syncTouch: false,
      duration: 1.05,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.1
    });
  } catch (error) {
    console.warn("[DLS Landing] Lenis no está disponible; se mantiene el scroll nativo.", error);
    root?.classList.add("is-motion-fallback");
    return { instance: null, cleanup: () => {} };
  }

  lenis.on("scroll", ScrollTrigger.update);
  const lenisTicker = time=>lenis.raf(time*1000);
  gsap.ticker.add(lenisTicker);
  gsap.ticker.lagSmoothing(0);

  return {
    instance: lenis,
    cleanup() {
      lenis.off?.("scroll", ScrollTrigger.update);
      gsap.ticker.remove(lenisTicker);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    }
  };
}

function setupHeader(header, wrapper) {
  if (!header || !wrapper) return () => {};

  let frame = 0;
  const update = () => {
    frame = 0;
    const scrollTop = Math.max(wrapper.scrollTop || 0, window.scrollY || 0);
    header.classList.toggle("is-scrolled", scrollTop > 16);
  };
  const requestUpdate = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  wrapper.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("scroll", requestUpdate, { passive: true });
  update();

  return () => {
    wrapper.removeEventListener("scroll", requestUpdate);
    window.removeEventListener("scroll", requestUpdate);
    window.cancelAnimationFrame(frame);
    header.classList.remove("is-scrolled");
  };
}

function setupAnchorNavigation(scope, wrapper, header, lenis, immediate) {
  const links = Array.from(scope.querySelectorAll("a[href^='#']"));
  const listeners = [];
  let initialHashFrame = 0;

  links.forEach((link) => {
    const onClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;

      let target;
      try {
        target = scope.querySelector(hash);
      } catch {
        return;
      }
      if (!target) return;

      event.preventDefault();
      const offset = -(header?.getBoundingClientRect().height || 0) - 16;
      const storyTrigger = target.matches("[data-story-step]")
        ? window.ScrollTrigger?.getById?.(`${LANDING_TRIGGER_PREFIX}story`)
        : null;
      const storyStart = Number(target.dataset.start);
      const storyEnd = Number(target.dataset.end);
      const hasStoryDestination =
        storyTrigger &&
        Number.isFinite(storyTrigger.start) &&
        Number.isFinite(storyTrigger.end) &&
        Number.isFinite(storyStart) &&
        Number.isFinite(storyEnd);
      const destination = hasStoryDestination
        ? storyTrigger.start +
          (((storyStart + storyEnd) * 0.5) / (FRAME_COUNT - 1)) *
            (storyTrigger.end - storyTrigger.start)
        : target.matches("[data-story-step]")
          ? target.closest(".dls-story") || target
          : target;
      const destinationOffset = hasStoryDestination ? 0 : offset;

      if (lenis) {
        lenis.scrollTo(destination, { offset: destinationOffset, duration: 1.05 });
      } else if (typeof destination === "number") {
        wrapper.scrollTo({ top: destination, behavior: immediate ? "auto" : "smooth" });
      } else {
        const wrapperTop = wrapper.getBoundingClientRect().top;
        const top =
          wrapper.scrollTop +
          destination.getBoundingClientRect().top -
          wrapperTop +
          destinationOffset;
        wrapper.scrollTo({ top, behavior: immediate ? "auto" : "smooth" });
      }

      if (window.location.hash !== hash) {
        history.pushState(history.state, "", hash);
      }
    };

    link.addEventListener("click", onClick);
    listeners.push(() => link.removeEventListener("click", onClick));
  });

  if (window.location.hash) {
    initialHashFrame = window.requestAnimationFrame(() => {
      const initialLink = links.find((link) => link.getAttribute("href") === window.location.hash);
      initialLink?.click();
    });
  }

  return () => {
    window.cancelAnimationFrame(initialHashFrame);
    runCleanups(listeners);
  };
}

function setupHeroTitle(scope, gsap, SplitText) {
  const title = scope.querySelector("[data-hero-title]");
  if (!title || typeof SplitText !== "function") return () => {};

  let split;
  let timeline;

  try {
    split = new SplitText(title, {
      type: "lines,chars",
      linesClass: "dls-hero-line",
      charsClass: "dls-hero-char",
      aria: "auto"
    });

    gsap.set(split.chars, {
      opacity: 0,
      yPercent: 112,
      rotationX: -34,
      transformOrigin: "50% 100%"
    });

    timeline = gsap.timeline({
      defaults: { ease: "power4.out" },
      delay: 0.08
    });
    timeline.to(split.chars, {
      opacity: 1,
      yPercent: 0,
      rotationX: 0,
      duration: 0.82,
      stagger: 0.018
    });
  } catch (error) {
    console.warn("[DLS Landing] SplitText no pudo preparar el titular.", error);
    split?.revert?.();
    return () => {};
  }

  return () => {
    timeline?.kill();
    split?.revert();
  };
}

function setupReveals(scope, wrapper, gsap) {
  const animations = [];
  const elements = Array.from(scope.querySelectorAll("[data-reveal]")).filter(
    (element) =>
      !element.matches("[data-story-step], [data-story-mobile]") &&
      !element.closest("[data-story-mobile]")
  );

  elements.forEach((element, index) => {
    gsap.set(element, { opacity: 0, y: 30 });
    const animation = gsap.to(element, {
      opacity: 1,
      y: 0,
      duration: 0.72,
      ease: "power3.out",
      delay: Math.min((index % 3) * 0.035, 0.07),
      scrollTrigger: {
        id: `${LANDING_TRIGGER_PREFIX}reveal-${index}`,
        trigger: element,
        scroller: wrapper,
        start: "top 86%",
        end: "bottom 18%",
        toggleActions: "play none none none",
        once: true,
        markers: false
      }
    });
    animations.push(animation);
  });

  return () => {
    animations.forEach((animation) => animation.kill());
    if (elements.length) gsap.set(elements, { clearProps: "opacity,transform" });
  };
}

function setupAurora(scope) {
  let cancelled = false;
  let rendererCleanup = null;

  scope.classList.add("is-webgl-fallback");
  import("../assets/vendor/three.module.min.js")
    .then((THREE) => {
      if (cancelled) return;
      rendererCleanup = setupAuroraRenderer(scope, THREE);
      if (cancelled) rendererCleanup?.();
    })
    .catch((error) => {
      if (cancelled) return;
      console.warn("[DLS Landing] Three.js no pudo cargarse; se usa el fondo CSS.", error);
      scope.classList.remove("has-webgl");
      scope.classList.add("is-webgl-fallback");
    });

  return () => {
    cancelled = true;
    rendererCleanup?.();
    rendererCleanup = null;
  };
}

function setupAuroraRenderer(scope, THREE) {
  const canvas = scope.querySelector("#dlsHeroCanvas");
  const hero = canvas?.closest("section") || canvas?.parentElement;
  if (!canvas || !hero) {
    scope.classList.add("is-webgl-fallback");
    return () => {};
  }

  let renderer;
  let geometry;
  let material;
  let resizeObserver;
  let intersectionObserver;
  let resizeHandler;
  let animationFrame = 0;
  let running = false;
  let disposed = false;
  let inView = true;
  let sampleStart = 0;
  let sampleFrames = 0;
  const originalTransform = canvas.style.transform;
  const pointer = new THREE.Vector2(0, 0);
  const pointerTarget = new THREE.Vector2(0, 0);

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 1;
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: pointer }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uPointer;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p = p * 2.03 + vec2(8.1, 3.7);
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          float aspect = uResolution.x / max(uResolution.y, 1.0);
          vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
          p += uPointer * 0.035;

          float flow = fbm(p * 1.45 + vec2(uTime * 0.035, -uTime * 0.025));
          float ribbonA = smoothstep(
            0.08,
            0.78,
            sin((p.x + flow * 0.38) * 3.7 + p.y * 2.2 + uTime * 0.17) * 0.5 + 0.5
          );
          float ribbonB = smoothstep(
            0.2,
            0.88,
            sin((p.y - flow * 0.3) * 5.1 - p.x * 1.8 - uTime * 0.13) * 0.5 + 0.5
          );

          vec3 ink = vec3(0.018, 0.025, 0.075);
          vec3 violet = vec3(0.31, 0.12, 0.72);
          vec3 cyan = vec3(0.02, 0.72, 0.88);
          vec3 coral = vec3(0.98, 0.22, 0.48);
          vec3 color = mix(ink, violet, ribbonA * 0.72);
          color = mix(color, cyan, ribbonB * 0.42);
          color += coral * pow(max(flow - 0.53, 0.0), 2.0) * 1.8;

          float vignette = 1.0 - smoothstep(
            0.2,
            1.08,
            length((vUv - 0.5) * vec2(0.8, 1.0))
          );
          gl_FragColor = vec4(color * (0.7 + vignette * 0.44), 0.96);
        }
      `
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || hero.clientWidth || window.innerWidth));
      const height = Math.max(1, Math.round(rect.height || hero.clientHeight || window.innerHeight));
      renderer.setSize(width, height, false);
      material.uniforms.uResolution.value.set(width, height);
    };

    const onPointerMove = (event) => {
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerTarget.set(
        clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
        clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -1, 1)
      );
    };

    const render = (time) => {
      if (!running || disposed) return;
      pointer.lerp(pointerTarget, 0.055);
      material.uniforms.uTime.value = time * 0.001;
      canvas.style.transform = `translate3d(${(pointer.x * 8).toFixed(2)}px, ${(pointer.y * -8).toFixed(2)}px, 0)`;
      renderer.render(scene, camera);

      if (!sampleStart) sampleStart = time;
      sampleFrames += 1;
      const elapsed = time - sampleStart;
      if (elapsed >= 1800) {
        const fps = (sampleFrames * 1000) / elapsed;
        if (fps < 34) {
          teardown(true);
          return;
        }
        sampleStart = Number.POSITIVE_INFINITY;
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (running || disposed || !inView || document.hidden) return;
      running = true;
      animationFrame = window.requestAnimationFrame(render);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    function teardown(useFallback) {
      if (disposed) return;
      disposed = true;
      stop();
      hero.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      geometry?.dispose();
      material?.dispose();
      renderer?.renderLists?.dispose?.();
      renderer?.forceContextLoss?.();
      renderer?.dispose();
      canvas.style.transform = originalTransform;
      scope.classList.remove("has-webgl");
      if (useFallback) scope.classList.add("is-webgl-fallback");
    }

    hero.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      resizeHandler = resize;
      window.addEventListener("resize", resizeHandler, { passive: true });
    }

    if ("IntersectionObserver" in window) {
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          inView = Boolean(entry?.isIntersecting);
          if (inView) start();
          else stop();
        },
        { rootMargin: "120px 0px" }
      );
      intersectionObserver.observe(hero);
    }

    resize();
    scope.classList.remove("is-webgl-fallback");
    scope.classList.add("has-webgl");
    start();

    return () => teardown(false);
  } catch (error) {
    console.warn("[DLS Landing] WebGL no está disponible; se usa el fondo CSS.", error);
    geometry?.dispose();
    material?.dispose();
    renderer?.dispose?.();
    canvas.style.transform = originalTransform;
    scope.classList.remove("has-webgl");
    scope.classList.add("is-webgl-fallback");
    return () => {};
  }
}

function setupStorySequence(scope, wrapper, gsap, ScrollTrigger) {
  const section = scope.querySelector("#demostracion");
  const stage = section?.querySelector(".dls-story-stage");
  const canvas = section?.querySelector("#dlsStoryCanvas");
  const progress = section?.querySelector("[data-story-progress]");
  const progressContainer = progress?.closest(".dls-story-loader") || progress;
  const frameLabel = section?.querySelector("[data-story-frame]");
  const steps = Array.from(section?.querySelectorAll("[data-story-step]") || []);
  const mobileBlocks = Array.from(section?.querySelectorAll("[data-story-mobile]") || []);
  if (!section || !stage || !canvas) return () => {};

  const canvasState = captureVisibility(canvas);
  const mobileStates = mobileBlocks.map(captureVisibility);
  canvas.hidden = false;
  canvas.removeAttribute("aria-hidden");
  mobileBlocks.forEach((block) => {
    block.hidden = true;
    block.setAttribute("aria-hidden", "true");
  });

  section.classList.add("is-story-loading");
  section.classList.remove("is-story-fallback", "is-story-ready");
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const frames = new Array(FRAME_COUNT);
  const pendingCancels = new Set();
  const ranges = buildStoryRanges(steps);
  const originalStepStates = steps.map((step) => step.classList.contains("is-active"));
  let cancelled = false;
  let nextFrame = 0;
  let completed = 0;
  let activeFrame = 0;
  let storyTrigger = null;
  let resizeObserver = null;
  let resizeHandler = null;
  let progressTimer = 0;
  let preloadDeadline = 0;
  let preloadAborted = false;
  let poster = null;
  let canvasWidth = 1;
  let canvasHeight = 1;
  const originalProgress = progress ? captureProgress(progress) : null;
  const originalProgressContainer =
    progressContainer && progressContainer !== progress ? captureVisibility(progressContainer) : null;
  const originalProgressContainerStyles =
    progressContainer && progressContainer !== progress
      ? {
          progress: progressContainer.style.getPropertyValue("--story-progress"),
          scale: progressContainer.style.getPropertyValue("--story-progress-scale")
        }
      : null;
  const originalFrameLabel = frameLabel?.textContent;

  if (!context) {
    activateFallback();
    return restore;
  }

  gsap.set(steps, { opacity: 0, yPercent: -38 });
  steps.forEach((step) => step.classList.remove("is-active"));
  updateProgress(0);
  resizeCanvas();

  loadImage(assetUrl("storyboard-backdrop.webp"), true).then((image) => {
    if (cancelled || !image) return;
    poster = image;
    if (!frames[activeFrame]) drawImageCover(poster);
  });

  const workers = Array.from({ length: 6 }, () => preloadWorker());
  preloadDeadline = window.setTimeout(() => {
    preloadAborted = true;
    pendingCancels.forEach((cancel) => cancel());
  }, 12000);
  Promise.all(workers).then(onPreloadComplete);

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      drawCurrentFrame();
    });
    resizeObserver.observe(canvas);
  } else {
    resizeHandler = () => {
      resizeCanvas();
      drawCurrentFrame();
    };
    window.addEventListener("resize", resizeHandler, { passive: true });
  }

  async function preloadWorker() {
    while (!cancelled && !preloadAborted) {
      const index = nextFrame;
      nextFrame += 1;
      if (index >= FRAME_COUNT) return;

      const url = assetUrl(`sequence/frame-${String(index + 1).padStart(3, "0")}.webp`);
      frames[index] = await loadImage(url, index < 3);
      if (cancelled) return;
      completed += 1;
      updateProgress(completed);
    }
  }

  function loadImage(url, highPriority) {
    return new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      let requestTimeout = 0;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(requestTimeout);
        image.onload = null;
        image.onerror = null;
        pendingCancels.delete(cancel);
        resolve(result);
      };
      const cancel = () => {
        image.onload = null;
        image.onerror = null;
        try {
          image.src = "";
        } catch {
          // Nothing else is required when a browser refuses to clear an image request.
        }
        finish(null);
      };

      pendingCancels.add(cancel);
      image.decoding = "async";
      image.fetchPriority = highPriority ? "high" : "low";
      image.onload = () => {
        if (typeof image.decode !== "function") {
          finish(image);
          return;
        }
        image.decode().then(() => finish(image)).catch(() => finish(image));
      };
      image.onerror = () => finish(null);
      requestTimeout = window.setTimeout(cancel, 9000);
      image.src = url;
    });
  }

  function onPreloadComplete() {
    if (cancelled) return;
    window.clearTimeout(preloadDeadline);

    const loadedCount = frames.filter(Boolean).length;
    updateProgress(FRAME_COUNT);

    if (preloadAborted || loadedCount < Math.ceil(FRAME_COUNT * 0.6)) {
      activateFallback();
      return;
    }

    fillMissingFrames(frames);
    activeFrame = 0;
    drawCurrentFrame();
    section.classList.remove("is-story-loading");
    section.classList.add("is-story-ready");
    progress?.classList.add("is-complete");
    progressContainer?.classList.add("is-complete");
    progress?.setAttribute("aria-busy", "false");
    progressTimer = window.setTimeout(() => {
      if (progressContainer) progressContainer.hidden = true;
    }, 260);

    updateStory(0);
    storyTrigger = ScrollTrigger.create({
      id: `${LANDING_TRIGGER_PREFIX}story`,
      trigger: stage,
      scroller: wrapper,
      start: "top 80px",
      end: () => `+=${Math.max(3600, Math.round(window.innerHeight * 5.25))}`,
      pin: stage,
      pinSpacing: true,
      scrub: 0.18,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      markers: false,
      onUpdate: (self) => updateStory(self.progress),
      onRefresh: (self) => {
        resizeCanvas();
        updateStory(self.progress);
      }
    });
    ScrollTrigger.refresh();
  }

  function updateStory(progressValue) {
    const normalized = clamp(progressValue, 0, 1);
    const next = Math.min(FRAME_COUNT - 1, Math.round(normalized * (FRAME_COUNT - 1)));
    if (next !== activeFrame || !frames[activeFrame]) {
      activeFrame = next;
      drawCurrentFrame();
    }
    if (frameLabel) {
      frameLabel.textContent = `Frame ${String(activeFrame + 1).padStart(3, "0")} / ${String(FRAME_COUNT).padStart(3, "0")}`;
    }

    const frameProgress = activeFrame / (FRAME_COUNT - 1);
    ranges.forEach(({ element, start, end }) => {
      const active = frameProgress >= start && frameProgress <= end;
      if (element.classList.contains("is-active") === active) return;
      element.classList.toggle("is-active", active);
      gsap.to(element, {
        opacity: active ? 1 : 0,
        yPercent: active ? -50 : frameProgress > end ? -60 : -38,
        duration: 0.24,
        ease: "power2.out",
        overwrite: true
      });
    });
  }

  function updateProgress(value) {
    if (!progress) return;
    const percentage = Math.round((value / FRAME_COUNT) * 100);
    progress.hidden = false;
    if (progressContainer) progressContainer.hidden = false;
    progress.classList.toggle("is-complete", value >= FRAME_COUNT);
    progressContainer?.classList.toggle("is-complete", value >= FRAME_COUNT);
    progress.setAttribute("aria-busy", String(value < FRAME_COUNT));
    progressContainer?.setAttribute("aria-busy", String(value < FRAME_COUNT));
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(percentage));
    progress.style.setProperty("--story-progress", `${percentage}%`);
    progress.style.setProperty("--story-progress-scale", String(value / FRAME_COUNT));
    progressContainer?.style.setProperty("--story-progress", `${percentage}%`);
    progressContainer?.style.setProperty("--story-progress-scale", String(value / FRAME_COUNT));
    if ("max" in progress) progress.max = FRAME_COUNT;
    if ("value" in progress) progress.value = value;
    const label = progress.querySelector("[data-story-progress-value]");
    if (label) label.textContent = `${percentage}%`;
    else if (!("value" in progress)) progress.textContent = `${percentage}%`;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || stage.clientWidth || window.innerWidth));
    const height = Math.max(1, Math.round(rect.height || stage.clientHeight || window.innerHeight));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const renderWidth = Math.round(width * pixelRatio);
    const renderHeight = Math.round(height * pixelRatio);

    canvasWidth = width;
    canvasHeight = height;
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
  }

  function drawCurrentFrame() {
    const image = frames[activeFrame] || poster;
    if (image) drawImageCover(image);
  }

  function drawImageCover(image) {
    if (!image?.naturalWidth || !image?.naturalHeight) return;
    const scale = Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = (canvasWidth - width) * 0.5;
    const y = (canvasHeight - height) * 0.5;
    context?.clearRect(0, 0, canvasWidth, canvasHeight);
    context.drawImage(image, x, y, width, height);
  }

  function activateFallback() {
    storyTrigger?.kill();
    storyTrigger = null;
    section.classList.remove("is-story-loading", "is-story-ready");
    section.classList.add("is-story-fallback");
    scope.classList.add("uses-story-fallback");
    canvas.hidden = true;
    canvas.setAttribute("aria-hidden", "true");
    mobileBlocks.forEach((block) => {
      block.hidden = false;
      block.removeAttribute("aria-hidden");
    });
    if (progress) {
      progress.classList.add("is-complete");
      progress.setAttribute("aria-busy", "false");
      progressContainer?.classList.add("is-complete");
      if (progressContainer) progressContainer.hidden = true;
    }
    gsap.set(steps, { clearProps: "opacity,transform" });
  }

  function restore() {
    cancelled = true;
    pendingCancels.forEach((cancel) => cancel());
    pendingCancels.clear();
    window.clearTimeout(progressTimer);
    window.clearTimeout(preloadDeadline);
    storyTrigger?.kill();
    resizeObserver?.disconnect();
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    gsap.killTweensOf(steps);
    gsap.set(steps, { clearProps: "opacity,transform" });
    steps.forEach((step, index) => {
      step.classList.toggle("is-active", originalStepStates[index]);
    });
    section.classList.remove("is-story-loading", "is-story-ready", "is-story-fallback");
    restoreVisibility(canvas, canvasState);
    mobileBlocks.forEach((block, index) => restoreVisibility(block, mobileStates[index]));
    if (progress && originalProgress) restoreProgress(progress, originalProgress);
    if (progressContainer && originalProgressContainer) {
      restoreVisibility(progressContainer, originalProgressContainer);
      progressContainer.classList.remove("is-complete");
      if (originalProgressContainerStyles?.progress) {
        progressContainer.style.setProperty(
          "--story-progress",
          originalProgressContainerStyles.progress
        );
      } else {
        progressContainer.style.removeProperty("--story-progress");
      }
      if (originalProgressContainerStyles?.scale) {
        progressContainer.style.setProperty(
          "--story-progress-scale",
          originalProgressContainerStyles.scale
        );
      } else {
        progressContainer.style.removeProperty("--story-progress-scale");
      }
    }
    if (frameLabel && originalFrameLabel != null) frameLabel.textContent = originalFrameLabel;
    context?.clearRect(0, 0, canvasWidth, canvasHeight);
  }

  return restore;
}

function setupStoryFallback(scope, wrapper, gsap) {
  const section = scope.querySelector("#demostracion");
  const canvas = section?.querySelector("#dlsStoryCanvas");
  const progress = section?.querySelector("[data-story-progress]");
  const progressContainer = progress?.closest(".dls-story-loader") || progress;
  const containers = resolveStoryFallbackContainers(section);
  const blocks = resolveStoryFallbackBlocks(section);
  if (!section) return () => {};

  const canvasState = canvas ? captureVisibility(canvas) : null;
  const progressState = progress ? captureVisibility(progress) : null;
  const progressContainerState =
    progressContainer && progressContainer !== progress ? captureVisibility(progressContainer) : null;
  const visibleElements = Array.from(new Set([...containers, ...blocks]));
  const elementStates = visibleElements.map(captureVisibility);
  const animations = [];

  section.classList.add("is-story-fallback");
  section.classList.remove("is-story-loading", "is-story-ready");
  if (canvas) {
    canvas.hidden = true;
    canvas.setAttribute("aria-hidden", "true");
  }
  if (progress) {
    progress.hidden = true;
    progress.setAttribute("aria-hidden", "true");
  }
  if (progressContainer) {
    progressContainer.hidden = true;
    progressContainer.setAttribute("aria-hidden", "true");
  }

  visibleElements.forEach((element) => {
    element.hidden = false;
    element.removeAttribute("aria-hidden");
  });

  blocks.forEach((block, index) => {
    gsap.set(block, { opacity: 0, y: 26 });
    animations.push(
      gsap.to(block, {
        opacity: 1,
        y: 0,
        duration: 0.68,
        ease: "power3.out",
        scrollTrigger: {
          id: `${LANDING_TRIGGER_PREFIX}story-fallback-${index}`,
          trigger: block,
          scroller: wrapper,
          start: "top 86%",
          end: "bottom 16%",
          toggleActions: "play none none none",
          once: true,
          markers: false
        }
      })
    );
  });

  return () => {
    animations.forEach((animation) => animation.kill());
    gsap.set(blocks, { clearProps: "opacity,transform" });
    section.classList.remove("is-story-fallback");
    if (canvas && canvasState) restoreVisibility(canvas, canvasState);
    if (progress && progressState) restoreVisibility(progress, progressState);
    if (progressContainer && progressContainerState) {
      restoreVisibility(progressContainer, progressContainerState);
    }
    visibleElements.forEach((element, index) => restoreVisibility(element, elementStates[index]));
  };
}

function setupHorizontalServices(scope, wrapper, gsap, ScrollTrigger) {
  const section = scope.querySelector("#servicios");
  const track = section?.querySelector("[data-services-track]");
  const cards = Array.from(track?.querySelectorAll(".dls-service-card") || []);
  const progress = section?.querySelector(".dls-services-progress");
  if (!section || !track || cards.length < 2) return () => {};

  let animation = null;
  let cancelled = false;
  const originalProgress = progress?.style.getPropertyValue("--dls-services-progress") || "";
  section.classList.add("is-horizontal");
  const installFrame = window.requestAnimationFrame(() => {
    if (cancelled) return;
    const viewport = track.parentElement?.clientWidth || section.clientWidth || window.innerWidth;
    const distance = Math.max(0, track.scrollWidth - viewport);
    if (distance < 24) {
      section.classList.remove("is-horizontal");
      return;
    }

    animation = gsap.to(track, {
      x: () => {
        const available = track.parentElement?.clientWidth || section.clientWidth || window.innerWidth;
        return -Math.max(0, track.scrollWidth - available);
      },
      ease: "none",
      scrollTrigger: {
        id: `${LANDING_TRIGGER_PREFIX}services`,
        trigger: section,
        scroller: wrapper,
        start: "top top",
        end: () => {
          const available = track.parentElement?.clientWidth || section.clientWidth || window.innerWidth;
          const travel = Math.max(0, track.scrollWidth - available);
          return `+=${Math.max(Math.round(travel), Math.round(window.innerHeight * 0.9))}`;
        },
        pin: true,
        pinSpacing: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        markers: false,
        onUpdate: (self) => {
          progress?.style.setProperty(
            "--dls-services-progress",
            String(0.12 + self.progress * 0.88)
          );
        }
      }
    });
    ScrollTrigger.refresh();
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(installFrame);
    animation?.kill();
    section.classList.remove("is-horizontal");
    gsap.set(track, { clearProps: "transform" });
    if (progress) {
      if (originalProgress) {
        progress.style.setProperty("--dls-services-progress", originalProgress);
      } else {
        progress.style.removeProperty("--dls-services-progress");
      }
    }
  };
}

function resetHorizontalServices(scope, gsap) {
  const section = scope.querySelector("#servicios");
  const track = section?.querySelector("[data-services-track]");
  if (!section || !track) return () => {};
  section.classList.remove("is-horizontal");
  gsap.set(track, { clearProps: "transform" });
  return () => {};
}

function setupTimeline(scope, wrapper, gsap) {
  const section = scope.querySelector("#como-funciona");
  const path = section?.querySelector("[data-timeline-path]");
  if (!section || !path || typeof path.getTotalLength !== "function") return () => {};

  let length;
  try {
    length = path.getTotalLength();
  } catch {
    return () => {};
  }
  if (!Number.isFinite(length) || length <= 0) return () => {};

  gsap.set(path, {
    strokeDasharray: length,
    strokeDashoffset: length
  });
  const animation = gsap.to(path, {
    strokeDashoffset: 0,
    ease: "none",
    scrollTrigger: {
      id: `${LANDING_TRIGGER_PREFIX}timeline`,
      trigger: section,
      scroller: wrapper,
      start: "top 78%",
      end: "bottom 32%",
      scrub: 0.55,
      invalidateOnRefresh: true,
      markers: false
    }
  });

  return () => {
    animation.kill();
    gsap.set(path, { clearProps: "strokeDasharray,strokeDashoffset" });
  };
}

function setupCounters(scope, wrapper, gsap, ScrollTrigger) {
  const counters = Array.from(scope.querySelectorAll("[data-counter][data-value]"));
  const records = [];
  const locale = document.documentElement.lang || "es-ES";

  counters.forEach((counter, index) => {
    const target = parseNumber(counter.dataset.value);
    if (!Number.isFinite(target)) return;

    const originalText = counter.textContent;
    const decimals = resolveDecimals(counter.dataset.value, counter.dataset.decimals);
    const prefix = counter.dataset.prefix || "";
    const suffix = counter.dataset.suffix || "";
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    const state = { value: 0 };
    let tween = null;

    const render = (value) => {
      counter.textContent = `${prefix}${formatter.format(value)}${suffix}`;
    };
    render(0);

    const trigger = ScrollTrigger.create({
      id: `${LANDING_TRIGGER_PREFIX}counter-${index}`,
      trigger: counter,
      scroller: wrapper,
      start: "top 84%",
      end: "bottom 18%",
      once: true,
      markers: false,
      onEnter: () => {
        tween = gsap.to(state, {
          value: target,
          duration: 1.35,
          ease: "power3.out",
          snap: decimals === 0 ? { value: 1 } : undefined,
          onUpdate: () => render(state.value),
          onComplete: () => render(target)
        });
      }
    });

    records.push({ counter, originalText, trigger, getTween: () => tween });
  });

  return () => {
    records.forEach(({ counter, originalText, trigger, getTween }) => {
      trigger.kill();
      getTween()?.kill();
      counter.textContent = originalText;
    });
  };
}

function setupCursor(scope, gsap) {
  const cursor =
    scope.querySelector("[data-landing-cursor]") || document.querySelector("[data-landing-cursor]");
  if (!cursor) return () => {};

  const original = captureVisibility(cursor);
  const interactiveSelector = "a, button, [role='button'], .dls-service-card, [data-cursor-active]";
  cursor.hidden = false;
  cursor.setAttribute("aria-hidden", "true");
  scope.classList.add("has-custom-cursor");
  document.body.classList.add("has-custom-cursor");
  gsap.set(cursor, { xPercent: -50, yPercent: -50, scale: 0.72, opacity: 0 });

  const moveX = gsap.quickTo(cursor, "x", { duration: 0.16, ease: "power3.out" });
  const moveY = gsap.quickTo(cursor, "y", { duration: 0.16, ease: "power3.out" });
  const onMove = (event) => {
    moveX(event.clientX);
    moveY(event.clientY);
    cursor.classList.add("is-visible");
    gsap.to(cursor, { opacity: 1, duration: 0.14, overwrite: "auto" });
  };
  const onOver = (event) => {
    if (!(event.target instanceof Element)) return;
    const active = Boolean(event.target.closest(interactiveSelector));
    cursor.classList.toggle("is-active", active);
    cursor.classList.toggle("is-over-target", active);
    gsap.to(cursor, {
      scale: active ? 1.75 : 0.72,
      duration: 0.2,
      ease: "power2.out",
      overwrite: "auto"
    });
  };
  const onOut = (event) => {
    if (!event.relatedTarget) {
      cursor.classList.remove("is-visible", "is-active", "is-over-target");
      gsap.to(cursor, {
        opacity: 0,
        scale: 0.72,
        duration: 0.14,
        overwrite: "auto"
      });
    }
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  scope.addEventListener("pointerover", onOver, { passive: true });
  window.addEventListener("pointerout", onOut, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onMove);
    scope.removeEventListener("pointerover", onOver);
    window.removeEventListener("pointerout", onOut);
    gsap.killTweensOf(cursor);
    gsap.set(cursor, { clearProps: "opacity,transform" });
    cursor.classList.remove("is-visible", "is-active", "is-over-target");
    scope.classList.remove("has-custom-cursor");
    document.body.classList.remove("has-custom-cursor");
    restoreVisibility(cursor, original);
  };
}

function setupMagneticButtons(scope, gsap) {
  const buttons = Array.from(scope.querySelectorAll(".dls-magnetic"));
  const listeners = [];

  buttons.forEach((button) => {
    const onMove = (event) => {
      const rect = button.getBoundingClientRect();
      const x = clamp((event.clientX - (rect.left + rect.width / 2)) * 0.16, -8, 8);
      const y = clamp((event.clientY - (rect.top + rect.height / 2)) * 0.16, -8, 8);
      gsap.to(button, { x, y, duration: 0.24, ease: "power2.out", overwrite: "auto" });
    };
    const onLeave = () => {
      gsap.to(button, {
        x: 0,
        y: 0,
        duration: 0.68,
        ease: "elastic.out(1, 0.35)",
        overwrite: "auto"
      });
    };

    button.addEventListener("pointermove", onMove, { passive: true });
    button.addEventListener("pointerleave", onLeave, { passive: true });
    listeners.push(() => {
      button.removeEventListener("pointermove", onMove);
      button.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(button);
      gsap.set(button, { clearProps: "x,y" });
    });
  });

  return () => runCleanups(listeners);
}

function setupServiceTilt(scope, gsap) {
  const cards = Array.from(scope.querySelectorAll(".dls-service-card"));
  const listeners = [];

  cards.forEach((card) => {
    gsap.set(card, { transformPerspective: 900, transformStyle: "preserve-3d" });

    const onMove = (event) => {
      const rect = card.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      gsap.to(card, {
        rotationY: clamp((x - 0.5) * 16, -8, 8),
        rotationX: clamp((0.5 - y) * 16, -8, 8),
        scale: 1.02,
        duration: 0.24,
        ease: "power2.out",
        overwrite: "auto"
      });
    };
    const onLeave = () => {
      gsap.to(card, {
        rotationX: 0,
        rotationY: 0,
        scale: 1,
        duration: 0.62,
        ease: "elastic.out(1, 0.38)",
        overwrite: "auto"
      });
    };

    card.addEventListener("pointermove", onMove, { passive: true });
    card.addEventListener("pointerleave", onLeave, { passive: true });
    listeners.push(() => {
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(card);
      gsap.set(card, { clearProps: "transform,transformStyle" });
    });
  });

  return () => runCleanups(listeners);
}

function setupPageWipe(scope, gsap) {
  const overlay = scope.querySelector("[data-page-wipe]") || document.querySelector("[data-page-wipe]");
  const links = Array.from(scope.querySelectorAll("[data-page-transition]"));
  if (!overlay || !links.length) return () => {};

  let navigating = false;
  let watchdog = 0;
  let wipeTween = null;
  const listeners = [];
  overlay.setAttribute("aria-hidden", "true");

  links.forEach((link) => {
    const onClick = (event) => {
      if (
        navigating ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      ) {
        return;
      }

      const href = link.getAttribute("href");
      if (!href) return;

      let destination;
      try {
        destination = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (destination.href === window.location.href) return;

      event.preventDefault();
      navigating = true;
      overlay.classList.add("is-active", "is-wiping");

      let committed = false;
      const navigate = () => {
        if (committed) return;
        committed = true;
        window.clearTimeout(watchdog);
        window.location.assign(destination.href);
      };

      gsap.set(overlay, {
        xPercent: -101,
        scaleY: 1,
        opacity: 1,
        pointerEvents: "auto"
      });
      wipeTween = gsap.to(overlay, {
        xPercent: 0,
        duration: 0.24,
        ease: "power3.inOut",
        overwrite: true,
        onComplete: navigate
      });
      watchdog = window.setTimeout(navigate, 280);
    };

    link.addEventListener("click", onClick);
    listeners.push(() => link.removeEventListener("click", onClick));
  });

  return () => {
    runCleanups(listeners);
    window.clearTimeout(watchdog);
    wipeTween?.kill();
    overlay.classList.remove("is-active", "is-wiping");
    gsap.set(overlay, { clearProps: "opacity,transform,pointerEvents" });
  };
}

function applyAccessibleFallback(scope) {
  const timelinePath = scope.querySelector("[data-timeline-path]");
  const counters = Array.from(scope.querySelectorAll("[data-counter][data-value]"));
  const storyCanvas = scope.querySelector("#dlsStoryCanvas");
  const storyProgress = scope.querySelector("[data-story-progress]");
  const storyProgressContainer = storyProgress?.closest(".dls-story-loader") || storyProgress;
  const storySection = scope.querySelector("#demostracion");
  const storyContainers = resolveStoryFallbackContainers(storySection);
  const storyBlocks = resolveStoryFallbackBlocks(storySection);
  const storyElements = Array.from(new Set([...storyContainers, ...storyBlocks]));
  const states = {
    timelineDasharray: timelinePath?.style.strokeDasharray,
    timelineDashoffset: timelinePath?.style.strokeDashoffset,
    canvas: storyCanvas ? captureVisibility(storyCanvas) : null,
    progress: storyProgress ? captureVisibility(storyProgress) : null,
    progressContainer:
      storyProgressContainer && storyProgressContainer !== storyProgress
        ? captureVisibility(storyProgressContainer)
        : null,
    blocks: storyElements.map(captureVisibility),
    counterText: counters.map((counter) => counter.textContent)
  };

  scope.querySelectorAll("[data-reveal], [data-story-step], [data-hero-title]").forEach((element) => {
    element.style.removeProperty("opacity");
    element.style.removeProperty("visibility");
    element.style.removeProperty("transform");
  });

  if (timelinePath) {
    timelinePath.style.strokeDasharray = "none";
    timelinePath.style.strokeDashoffset = "0";
  }

  counters.forEach((counter) => renderCounterFinal(counter));

  if (storyCanvas) {
    storyCanvas.hidden = true;
    storyCanvas.setAttribute("aria-hidden", "true");
  }
  if (storyProgress) {
    storyProgress.hidden = true;
    storyProgress.setAttribute("aria-hidden", "true");
  }
  if (storyProgressContainer) {
    storyProgressContainer.hidden = true;
    storyProgressContainer.setAttribute("aria-hidden", "true");
  }
  storyElements.forEach((element) => {
    element.hidden = false;
    element.removeAttribute("aria-hidden");
  });

  return () => {
    if (timelinePath) {
      timelinePath.style.strokeDasharray = states.timelineDasharray || "";
      timelinePath.style.strokeDashoffset = states.timelineDashoffset || "";
    }
    counters.forEach((counter, index) => {
      counter.textContent = states.counterText[index];
    });
    if (storyCanvas && states.canvas) restoreVisibility(storyCanvas, states.canvas);
    if (storyProgress && states.progress) restoreVisibility(storyProgress, states.progress);
    if (storyProgressContainer && states.progressContainer) {
      restoreVisibility(storyProgressContainer, states.progressContainer);
    }
    storyElements.forEach((element, index) => restoreVisibility(element, states.blocks[index]));
  };
}

function buildStoryRanges(steps) {
  const segment = steps.length ? 1 / steps.length : 1;
  const usesFrameNumbers = steps
    .flatMap((element) => [element.dataset.start, element.dataset.end])
    .filter((value) => value != null && value !== "" && !String(value).trim().endsWith("%"))
    .some((value) => parseNumber(value) > 1);

  return steps.map((element, index) => {
    const defaultStart = index * segment;
    const defaultEnd = (index + 1) * segment;
    const start = parseStoryPoint(element.dataset.start, defaultStart, usesFrameNumbers);
    const parsedEnd = parseStoryPoint(element.dataset.end, defaultEnd, usesFrameNumbers);
    return {
      element,
      start,
      end: Math.max(start + 0.001, parsedEnd)
    };
  });
}

function parseStoryPoint(raw, fallback, usesFrameNumbers) {
  if (raw == null || raw === "") return fallback;
  const value = String(raw).trim();
  const numeric = parseNumber(value.replace("%", ""));
  if (!Number.isFinite(numeric)) return fallback;
  if (value.endsWith("%")) return clamp(numeric / 100, 0, 1);
  if (usesFrameNumbers) return clamp(numeric / (FRAME_COUNT - 1), 0, 1);
  if (numeric >= 0 && numeric <= 1) return numeric;
  return clamp(numeric / (FRAME_COUNT - 1), 0, 1);
}

function fillMissingFrames(frames) {
  let previous = null;
  for (let index = 0; index < frames.length; index += 1) {
    if (frames[index]) previous = frames[index];
    else if (previous) frames[index] = previous;
  }

  let next = null;
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (frames[index]) next = frames[index];
    else if (next) frames[index] = next;
  }
}

function resolveStoryFallbackBlocks(section) {
  if (!section) return [];
  const containers = resolveStoryFallbackContainers(section);
  if (containers.length !== 1) return containers;
  const cards = Array.from(
    containers[0].querySelectorAll(":scope > article, :scope > .dls-story-mobile-card")
  );
  return cards.length ? cards : containers;
}

function resolveStoryFallbackContainers(section) {
  if (!section) return [];
  return Array.from(section.querySelectorAll("[data-story-mobile]"));
}

function renderCounterFinal(counter) {
  const target = parseNumber(counter.dataset.value);
  if (!Number.isFinite(target)) return;
  const decimals = resolveDecimals(counter.dataset.value, counter.dataset.decimals);
  const formatter = new Intl.NumberFormat(document.documentElement.lang || "es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  counter.textContent = `${counter.dataset.prefix || ""}${formatter.format(target)}${counter.dataset.suffix || ""}`;
}

function resolveDecimals(rawValue, explicitDecimals) {
  if (explicitDecimals != null && explicitDecimals !== "") {
    return clamp(Math.round(parseNumber(explicitDecimals) || 0), 0, 4);
  }
  const normalized = String(rawValue || "").replace(",", ".");
  return clamp(normalized.includes(".") ? normalized.split(".")[1].length : 0, 0, 4);
}

function captureVisibility(element) {
  return {
    hidden: element.hidden,
    hadAriaHidden: element.hasAttribute("aria-hidden"),
    ariaHidden: element.getAttribute("aria-hidden"),
    hadAriaBusy: element.hasAttribute("aria-busy"),
    ariaBusy: element.getAttribute("aria-busy")
  };
}

function restoreVisibility(element, state) {
  if (!element || !state) return;
  element.hidden = state.hidden;
  if (state.hadAriaHidden) element.setAttribute("aria-hidden", state.ariaHidden);
  else element.removeAttribute("aria-hidden");
  if (state.hadAriaBusy) element.setAttribute("aria-busy", state.ariaBusy);
  else element.removeAttribute("aria-busy");
}

function captureProgress(progress) {
  return {
    visibility: captureVisibility(progress),
    className: progress.className,
    ariaBusy: progress.getAttribute("aria-busy"),
    ariaValueMin: progress.getAttribute("aria-valuemin"),
    ariaValueMax: progress.getAttribute("aria-valuemax"),
    ariaValueNow: progress.getAttribute("aria-valuenow"),
    cssProgress: progress.style.getPropertyValue("--story-progress"),
    cssProgressScale: progress.style.getPropertyValue("--story-progress-scale"),
    max: "max" in progress ? progress.max : null,
    value: "value" in progress ? progress.value : null,
    label: progress.querySelector("[data-story-progress-value]")?.textContent,
    textContent: progress.textContent
  };
}

function restoreProgress(progress, state) {
  restoreVisibility(progress, state.visibility);
  progress.className = state.className;
  restoreAttribute(progress, "aria-busy", state.ariaBusy);
  restoreAttribute(progress, "aria-valuemin", state.ariaValueMin);
  restoreAttribute(progress, "aria-valuemax", state.ariaValueMax);
  restoreAttribute(progress, "aria-valuenow", state.ariaValueNow);
  if (state.cssProgress) progress.style.setProperty("--story-progress", state.cssProgress);
  else progress.style.removeProperty("--story-progress");
  if (state.cssProgressScale) {
    progress.style.setProperty("--story-progress-scale", state.cssProgressScale);
  } else {
    progress.style.removeProperty("--story-progress-scale");
  }
  if ("max" in progress && state.max != null) progress.max = state.max;
  if ("value" in progress && state.value != null) progress.value = state.value;
  const label = progress.querySelector("[data-story-progress-value]");
  if (label && state.label != null) label.textContent = state.label;
  else progress.textContent = state.textContent;
}

function restoreAttribute(element, name, value) {
  if (value == null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function assetUrl(relativePath) {
  return new URL(`../assets/landing/${relativePath}`, import.meta.url).href;
}

function detectLowHardware() {
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memory = Number(navigator.deviceMemory || 0);
  const saveData = Boolean(navigator.connection?.saveData);
  return saveData || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
}

function parseNumber(value) {
  return Number.parseFloat(String(value ?? "").trim().replace(",", "."));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function addCleanup(cleanup) {
  if (typeof cleanup === "function") cleanups.push(cleanup);
}

function runCleanups(tasks) {
  while (tasks.length) {
    const cleanup = tasks.pop();
    try {
      cleanup?.();
    } catch (error) {
      console.warn("[DLS Landing] Una tarea de limpieza no pudo completarse.", error);
    }
  }
}

function destroy() {
  if (destroyed) return;
  destroyed = true;
  document.removeEventListener("DOMContentLoaded", init);
  runCleanups(cleanups);

  if (window.ScrollTrigger) {
    window.ScrollTrigger.getAll()
      .filter((trigger) => String(trigger.vars?.id || "").startsWith(LANDING_TRIGGER_PREFIX))
      .forEach((trigger) => trigger.kill());
  }

  if (root) {
    ENHANCEMENT_CLASSES.forEach((className) => root.classList.remove(className));
    root.querySelector("[data-landing-header]")?.classList.remove("is-scrolled");
  }
}
