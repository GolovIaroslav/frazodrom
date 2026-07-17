import { Link, Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { Toast } from './components/Toast';
import { KokoroPromptBanner } from './components/KokoroPromptBanner';
import { HomeScreen } from './screens/HomeScreen';
import { CourseMapScreen } from './screens/CourseMapScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DrillScreen } from './screens/DrillScreen';
import { FreeTalkScreen } from './screens/FreeTalkScreen';
import { FluencySprintScreen } from './screens/FluencySprintScreen';
import { ListeningScreen } from './screens/ListeningScreen';
import { useI18nStore } from './i18n/store';

function NotFoundScreen(): React.ReactElement {
  const t = useI18nStore((s) => s.t);

  return (
    <div className="p-6" data-testid="not-found-screen">
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <p className="mt-4 text-neutral-600 dark:text-neutral-400">{t('notFound.body')}</p>
      <Link to="/" className="mt-4 inline-flex rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}

function App(): React.ReactElement {
  return (
    <div className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <NavBar />
      <main data-testid="app-main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/course-map" element={<CourseMapScreen />} />
          <Route path="/drill/:skillId" element={<DrillScreen />} />
          <Route path="/session" element={<DrillScreen />} />
          <Route path="/sprint" element={<FluencySprintScreen />} />
          <Route path="/listening" element={<ListeningScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/free-talk" element={<FreeTalkScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </main>
      <Toast />
      <KokoroPromptBanner />
    </div>
  );
}

export default App;
