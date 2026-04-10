import './globals.css';

export const metadata = {
  title: 'To-Do App',
  description: 'Grouped tasks with Google Calendar integration',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
