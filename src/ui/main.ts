import './styles.css';
import './baseline.css';
import { App } from './app';

const root = document.getElementById('app')!;
const app = new App(root);
// Handy for debugging from DevTools
(window as unknown as { baseline_app: App }).baseline_app = app;
