import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { FortisProjectPage } from './FortisProjectPage';
import '../styles/global.css';
import './fortis-project.css';

createRoot(document.getElementById('fortis-project-root')!).render(
  <StrictMode>
    <ErrorBoundary><FortisProjectPage /></ErrorBoundary>
  </StrictMode>,
);
