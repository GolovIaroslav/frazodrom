import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './screens/HomeScreen';
import { CourseMapScreen } from './screens/CourseMapScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function App(): React.ReactElement {
  return (
    <div className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <NavBar />
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/course-map" element={<CourseMapScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </div>
  );
}

export default App;
