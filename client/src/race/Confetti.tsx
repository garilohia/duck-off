// A little paper shower for crossing the line. Pure CSS; the pieces are laid out deterministically.
const COLORS = ['#ffd02b', '#f27860', '#428fda', '#63c27a', '#fffdf5'];

export default function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 42 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 7) * 0.12}s`,
            animationDuration: `${2.4 + (i % 5) * 0.3}s`,
            background: COLORS[i % 5],
            transform: `rotate(${i * 23}deg)`,
          }}
        />
      ))}
    </div>
  );
}
