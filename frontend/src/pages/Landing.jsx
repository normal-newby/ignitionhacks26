import { Link } from 'react-router-dom';
import { Boxes, Video, Sparkles, Move3d, Save, Users, ArrowRight } from 'lucide-react';

/**
 * The public front door. Everything else in the app needs an account, so this is the one page
 * a signed-out visitor can reach — App redirects straight past it once there's a session,
 * since somebody already signed in wants their rooms, not the pitch.
 *
 * Same pixel language as the rest of the app: square corners from `--radius: 0rem`, depth from
 * a 2px border plus an offset hard shadow rather than a blur. Press Start 2P is roughly half
 * again as wide as a normal mono, so every `font-heading` here is stepped down a size or two
 * from what the same heading would be in a proportional face.
 */

const STEPS = [
  {
    icon: Video,
    title: 'Scan',
    body: 'Film a room panaroma-style with your phone camera. That\'s all you need! No measurements required.',
  },
  {
    icon: Sparkles,
    title: 'Reconstruct',
    body: 'World Labs Marble rebuilds the whole room as a 3D scene: walls, floor, windows, and everything else.',
  },
  {
    icon: Move3d,
    title: 'Furnish',
    body: 'Drag furniture in from the catalog. Move, turn and resize them however you want. Walk through the result at eye height.',
  },
];

/** Square, unblurred, offset-shadowed — the app's one card treatment. */
const PANEL = 'bg-[#e2e8f0] border-2 border-[#1e40af] shadow-[4px_4px_0px_#1e40af]';

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#3b82f6] text-white ' +
  'font-terminal text-lg uppercase border-2 border-[#1e40af] shadow-[3px_3px_0px_#1e40af] ' +
  'hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 ' +
  'active:translate-y-0.5 transition-shadow';

const SECONDARY_BUTTON =
  'inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#e2e8f0] text-[#252525] ' +
  'font-terminal text-lg uppercase border-2 border-[#1e40af] shadow-[3px_3px_0px_#1e40af] ' +
  'hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 ' +
  'active:translate-y-0.5 transition-shadow';

/**
 * A flat pixel plan of a furnished room, drawn rather than photographed.
 *
 * A screenshot would be the honest thing to show, but the editor needs a finished scan to
 * produce one and this page has to render before anyone has made one. So: an obvious diagram,
 * in the palette, that doesn't pretend to be a render.
 */
function RoomDiagram() {
  return (
    <svg viewBox="0 0 320 220" className="w-full h-auto" role="img"
         aria-label="Pixel diagram of a room plan with furniture placed in it">
      <rect x="0" y="0" width="320" height="220" fill="#cbd5e1" />

      {/* Floor grid — one square reads as roughly half a metre. */}
      <g stroke="#94a3b8" strokeWidth="1">
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={20 * (i + 1)} y1="0" x2={20 * (i + 1)} y2="220" />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={20 * (i + 1)} x2="320" y2={20 * (i + 1)} />
        ))}
      </g>

      {/* Walls, with a gap for the doorway on the right. */}
      <g fill="#1e40af">
        <rect x="20" y="20" width="280" height="8" />
        <rect x="20" y="20" width="8" height="180" />
        <rect x="20" y="192" width="280" height="8" />
        <rect x="292" y="20" width="8" height="70" />
        <rect x="292" y="140" width="8" height="60" />
      </g>

      {/* Furniture. Blue is placed-and-selected, grey is placed. */}
      <g stroke="#1e40af" strokeWidth="3">
        <rect x="48" y="48" width="96" height="40" fill="#3b82f6" />
        <rect x="60" y="108" width="72" height="36" fill="#5a6c80" />
        <rect x="188" y="48" width="40" height="40" fill="#5a6c80" />
        <rect x="196" y="128" width="72" height="48" fill="#5a6c80" />
        <rect x="248" y="44" width="24" height="24" fill="#10b981" />
      </g>

      {/* Selection ticks on the blue piece, the way the editor marks the active item. */}
      <g fill="#ef4444">
        {[[44, 44], [140, 44], [44, 84], [140, 84]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" />
        ))}
      </g>
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col animate-fade-in">
      {/* Top bar. Its own, not the app shell's: this page has different destinations. */}
      <header className="border-b-2 border-[#1e40af] bg-[#e2e8f0]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#3b82f6] border-2 border-[#1e40af] flex items-center justify-center">
              <Boxes className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading text-sm text-[#252525]">REFURNISH</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3 py-1.5 font-terminal text-base uppercase text-[#252525] border-2 border-transparent hover:border-[#1e40af] transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login?mode=register"
              className="px-3 py-1.5 bg-[#3b82f6] text-white font-terminal text-base uppercase border-2 border-[#1e40af] shadow-[2px_2px_0px_#1e40af] hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-shadow"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <span className="inline-block px-2.5 py-1 mb-6 bg-[#cbd5e1] border-2 border-[#1e40af] font-heading text-[8px] uppercase text-[#1e40af]">
                3D interior planner
              </span>
              <h1 className="font-heading text-lg sm:text-xl lg:text-2xl leading-[1.7] text-[#252525]">
                FURNISH A ROOM<br />
                BEFORE YOU MOVE<br />
                ANYTHING
              </h1>
              <p className="font-mono text-sm text-[#5a6c80] mt-6 max-w-md leading-relaxed">
                Upload a short panorama video of a room. Refurnish rebuilds it in 3D, then lets you place
                real furniture at real size inside it. No more relying on imaginary measurements - see if
                that sofa fits in before you move it.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/login?mode=register" className={PRIMARY_BUTTON}>
                  Start scanning
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/login" className={SECONDARY_BUTTON}>
                  I have an account
                </Link>
              </div>
              <p className="font-mono text-[11px] text-[#5a6c80] mt-4">
                100% Free | Five minutes to scan
              </p>
            </div>

            <div className={`${PANEL} p-3`}>
              <RoomDiagram />
              <div className="flex items-center justify-between px-1 pt-3">
                <span className="font-heading text-[8px] uppercase text-[#1e40af]">
                  Living room
                </span>
                <span className="font-mono text-[10px] text-[#5a6c80]">5 pieces placed</span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y-2 border-[#1e40af] bg-[#cbd5e1]">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <h2 className="font-heading text-sm uppercase text-[#252525] mb-2">How it works</h2>
            <p className="font-mono text-sm text-[#5a6c80] mb-10">
              Three simple steps
            </p>
            <div className="grid md:grid-cols-3 gap-5">
              {STEPS.map((step, index) => (
                <div key={step.title} className={`${PANEL} p-5`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 flex-shrink-0 bg-[#3b82f6] border-2 border-[#1e40af] flex items-center justify-center">
                      <step.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-heading text-[10px] text-[#1e40af]">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="font-heading text-[11px] uppercase text-[#252525] mb-3">
                    {step.title}
                  </h3>
                  <p className="font-mono text-xs text-[#5a6c80] leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
