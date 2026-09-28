export const animation = {
  duration: {
    instant: 100,
    fast: 200,
    normal: 350,
    slow: 600,
    reduced: 150,
    skeleton: 1500,
    toast: 2600,
  },
  easing: {
    instant: "cubic-bezier(0.2, 0, 0, 1)",
    standard: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.7, 0, 0.84, 0)",
  },
  stagger: {
    item: 30,
    maximum: 300,
  },
  page: {
    enter: 250,
    enterDelay: 100,
    exit: 150,
  },
  modal: { duration: 350 },
  feedback: { duration: 350 },
} as const;

export const animationCssVariables = {
  "--duration-instant": `${animation.duration.instant}ms`,
  "--duration-fast": `${animation.duration.fast}ms`,
  "--duration-normal": `${animation.duration.normal}ms`,
  "--duration-slow": `${animation.duration.slow}ms`,
  "--duration-reduced": `${animation.duration.reduced}ms`,
  "--duration-skeleton": `${animation.duration.skeleton}ms`,
  "--duration-toast": `${animation.duration.toast}ms`,
  "--stagger-item": `${animation.stagger.item}ms`,
  "--stagger-maximum": `${animation.stagger.maximum}ms`,
  "--page-enter-duration": `${animation.page.enter}ms`,
  "--page-enter-delay": `${animation.page.enterDelay}ms`,
  "--page-exit-duration": `${animation.page.exit}ms`,
  "--modal-duration": `${animation.modal.duration}ms`,
  "--feedback-duration": `${animation.feedback.duration}ms`,
  "--ease-instant": animation.easing.instant,
  "--ease-standard": animation.easing.standard,
  "--ease-exit": animation.easing.exit,
} as const;
