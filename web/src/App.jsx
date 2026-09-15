import { useCallback, useRef, useState } from 'react'
import useLenis from './hooks/useLenis.js'
import useKonami from './hooks/useKonami.js'
import CustomCursor from './components/CustomCursor.jsx'
import FloatingNav from './components/FloatingNav.jsx'
import Hero from './components/Hero.jsx'
import Memory from './components/Memory.jsx'
import Gallery from './components/Gallery.jsx'
import Loss from './components/Loss.jsx'
import Mission from './components/Mission.jsx'
import DogsEffect from './components/DogsEffect.jsx'
import DracoFund from './components/DracoFund.jsx'
import ImpactLedger from './components/ImpactLedger.jsx'
import Token from './components/Token.jsx'
import Archive from './components/Archive.jsx'
import DogStories from './components/DogStories.jsx'
import Community from './components/Community.jsx'
import FinalCTA from './components/FinalCTA.jsx'
import Footer from './components/Footer.jsx'
import EasterEggToast from './components/EasterEggToast.jsx'

export default function App() {
  useLenis()
  const heroRef = useRef(null)
  const [logoClicks, setLogoClicks] = useState(0)
  const [egg, setEgg] = useState(null)

  const handleLogoClick = useCallback(() => {
    setLogoClicks((c) => {
      const next = c + 1
      if (next >= 3) {
        setEgg('She is always here.')
        setTimeout(() => setEgg(null), 3000)
        return 0
      }
      return next
    })
  }, [])

  useKonami(
    useCallback(() => {
      setEgg('GOOD GIRL.')
      setTimeout(() => setEgg(null), 3000)
    }, [])
  )

  return (
    <div className="bg-black">
      <div className="grain" />
      <CustomCursor />
      <FloatingNav onLogoClick={handleLogoClick} />

      <Hero scrollRef={heroRef} />
      <Memory />
      <Gallery />
      <Loss />
      <Mission />
      <DogsEffect />
      <DracoFund />
      <ImpactLedger />
      <Token />
      <Archive />
      <DogStories />
      <Community />
      <FinalCTA />
      <Footer />

      <EasterEggToast message={egg} />
    </div>
  )
}
