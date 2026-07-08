import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { Toast } from './components/Toast';
import { HomeScreen } from './screens/HomeScreen';
import { CourseMapScreen } from './screens/CourseMapScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DrillScreen } from './screens/DrillScreen';
import { FreeTalkScreen } from './screens/FreeTalkScreen';

function App(): React.ReactElement {
  return (
    <div className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <NavBar />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/course-map" element={<CourseMapScreen />} />
        <Route path="/drill/:skillId" element={<DrillScreen />} />
        <Route path="/session" element={<DrillScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/free-talk" element={<FreeTalkScreen />} />
      </Routes>
      <Toast />
    </div>
  );
}

export default App;
