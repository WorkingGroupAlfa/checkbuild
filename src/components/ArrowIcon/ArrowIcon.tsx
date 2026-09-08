type ArrowDirection = 'left' | 'right' | 'down' | 'up-right';

type Props = {
  direction?: ArrowDirection;
};

export function ArrowIcon({ direction = 'right' }: Props) {
  const diagonal = direction === 'up-right';

  return (
    <svg
      className={`arrow-icon arrow-icon--${direction}`}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {diagonal
        ? <path d="M4.5 15.5 15.5 4.5M8 4.5h7.5V12" />
        : <path d="M3 10h14M11.5 4.5 17 10l-5.5 5.5" />}
    </svg>
  );
}
