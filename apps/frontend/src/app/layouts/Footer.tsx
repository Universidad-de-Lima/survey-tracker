export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white text-center py-4 px-6 mt-auto">
      <p>&copy; {currentYear}. Todos los derechos reservados.</p>
    </footer>
  );
}
