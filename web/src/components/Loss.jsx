import RevealLines from './RevealLines.jsx'

export default function Loss() {
  return (
    <section className="relative bg-black py-56 px-6 flex flex-col items-center justify-center gap-24">
      <RevealLines
        className="text-center"
        lineClassName="text-3xl md:text-6xl font-medium text-[#ece7de] leading-tight"
        lines={['AND THEN ONE DAY,', 'THERE WAS NO TOMORROW.']}
      />
      <RevealLines
        className="text-center"
        lineClassName="text-2xl md:text-5xl text-white/70 font-light"
        lines={["WE COULDN'T SAVE HER."]}
      />
      <RevealLines
        className="text-center"
        lineClassName="text-4xl md:text-7xl font-semibold text-[#ece7de]"
        lines={['BUT MAYBE WE CAN HELP THEM.']}
      />
    </section>
  )
}
