import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DemoModeBanner from './components/DemoModeBanner.jsx'
import HomePage from './pages/HomePage.jsx'
import DonatePage from './pages/DonatePage.jsx'
import FundPage from './pages/FundPage.jsx'
import ImpactPage from './pages/ImpactPage.jsx'
import TransparencyPage from './pages/TransparencyPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminCasesPage from './pages/admin/AdminCasesPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <DemoModeBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/donate" element={<DonatePage />} />
        <Route path="/fund" element={<FundPage />} />
        <Route path="/impact" element={<ImpactPage />} />
        <Route path="/transparency" element={<TransparencyPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/cases" element={<AdminCasesPage />} />
      </Routes>
    </BrowserRouter>
  )
}
