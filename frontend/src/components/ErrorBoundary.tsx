import { Component, type ErrorInfo, type ReactNode } from "react";
import ServerErrorPage from "../page/ServerErrorPage";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <ServerErrorPage onReset={this.reset} />;
    }
    return this.props.children;
  }
}
