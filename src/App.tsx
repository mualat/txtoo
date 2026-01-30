import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import ViewNote from './ViewNote';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/:idKey" element={<ViewNote />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
