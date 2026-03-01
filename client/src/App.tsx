import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import DoctorDetail from "./pages/DoctorDetail";
import Hospitals from "./pages/Hospitals";
import AITriagePage from "./pages/AITriage";
import AppointmentAccessPage from "./pages/AppointmentAccess";
import VisitRoomPage from "./pages/VisitRoom";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/triage"} component={AITriagePage} />
      <Route path={"/appointment/:id"} component={AppointmentAccessPage} />
      <Route path={"/visit/:id"} component={VisitRoomPage} />
      <Route path={"/doctor/:id"} component={DoctorDetail} />
      <Route path={"/hospitals"} component={Hospitals} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
