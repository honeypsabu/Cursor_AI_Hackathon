import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import ViewProfile from './pages/ViewProfile'
import EditProfile from './pages/EditProfile'
import MapView from './pages/MapView'
import Notifications from './pages/Notifications'
import Groups from './pages/Groups'
import GroupChat from './pages/GroupChat'
import UserProfile from './pages/UserProfile'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedLayout from './components/ProtectedLayout'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
        <Route path="/profile" element={<ViewProfile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/profile/map" element={<MapView />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/groups/:groupId" element={<GroupChat />} />
        <Route path="/user/:userId" element={<UserProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
