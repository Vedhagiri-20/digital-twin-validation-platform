import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    console.error("Digital Twin UI runtime error:", error);
    console.error(info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="react-error-panel">
          <h2>Validation view encountered an error</h2>

          <p>
            The application is still running. The validation result view
            received data in a format it did not expect.
          </p>

          <pre>
            {this.state.error?.message || "Unknown React error"}
          </pre>

          <p>
            Refresh the page to return to the workspace.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
