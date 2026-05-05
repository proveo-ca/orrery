class Joystick {
  readonly el: HTMLDivElement;
  private inner!: HTMLDivElement;
  private readonly radius: number;
  private activeId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  // Normalized stick offset in [-1, 1]. y is +1 down, -1 up (screen coords).
  x = 0;
  y = 0;

  constructor(
    side: 'left' | 'right',
    radius: number,
    labels?: { up: string; down: string; left: string; right: string },
  ) {
    this.radius = radius;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      bottom: '30px',
      [side]: '30px',
      width: `${radius * 2}px`,
      height: `${radius * 2}px`,
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '2px solid rgba(255, 255, 255, 0.25)',
      touchAction: 'none',
      zIndex: '200',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    } as Partial<CSSStyleDeclaration>);

    if (labels) {
      const cues: Array<[string, Partial<CSSStyleDeclaration>]> = [
        [labels.up,    { top: '6px',    left: '50%', transform: 'translateX(-50%)' }],
        [labels.down,  { bottom: '6px', left: '50%', transform: 'translateX(-50%)' }],
        [labels.left,  { left: '8px',   top:  '50%', transform: 'translateY(-50%)' }],
        [labels.right, { right: '8px',  top:  '50%', transform: 'translateY(-50%)' }],
      ];
      for (const [txt, style] of cues) {
        const span = document.createElement('span');
        span.textContent = txt;
        Object.assign(span.style, {
          position: 'absolute',
          color: 'rgba(255, 255, 255, 0.55)',
          font: 'bold 14px monospace',
          pointerEvents: 'none',
          ...style,
        } as Partial<CSSStyleDeclaration>);
        this.el.appendChild(span);
      }
    }

    this.inner = document.createElement('div');
    Object.assign(this.inner.style, {
      position: 'absolute',
      width: `${radius}px`,
      height: `${radius}px`,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.35)',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    this.el.appendChild(this.inner);

    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    const rect = this.el.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.update(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    this.update(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.x = 0;
    this.y = 0;
    this.inner.style.transform = 'translate(-50%, -50%)';
  };

  private update(clientX: number, clientY: number) {
    const dx = clientX - this.centerX;
    const dy = clientY - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const factor = dist > this.radius ? this.radius / dist : 1;
    const cx = dx * factor;
    const cy = dy * factor;
    this.x = cx / this.radius;
    this.y = cy / this.radius;
    this.inner.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;
  }
}

export class MobileControls {
  readonly enabled: boolean;
  private leftStick: Joystick | null = null;
  private rightStick: Joystick | null = null;

  constructor() {
    this.enabled = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!this.enabled) return;

    this.leftStick = new Joystick('left', 60, { up: 'W', down: 'S', left: 'A', right: 'D' });
    this.rightStick = new Joystick('right', 60);
    document.body.appendChild(this.leftStick.el);
    document.body.appendChild(this.rightStick.el);
  }

  get moveX(): number { return this.leftStick?.x ?? 0; }
  get moveY(): number { return this.leftStick?.y ?? 0; }
  get lookX(): number { return this.rightStick?.x ?? 0; }
  get lookY(): number { return this.rightStick?.y ?? 0; }
}
