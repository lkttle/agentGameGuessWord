## ADDED Requirements

### Requirement: Consistent design tokens across primary pages
The frontend SHALL use consistent color, typography, spacing, and component token conventions across home and result pages.

#### Scenario: User navigates between primary pages
- **WHEN** a user switches between home dashboard and result page
- **THEN** visual hierarchy, component shapes, and typography remain consistent under one design language

### Requirement: Accessibility baseline for interactions
The frontend MUST satisfy baseline interaction accessibility for forms and controls.

#### Scenario: Keyboard and focus interaction
- **WHEN** a user navigates interactive elements via keyboard
- **THEN** controls expose visible focus states and maintain readable text contrast in light theme

### Requirement: Responsive behavior for demo breakpoints
The frontend SHALL remain usable across mobile and desktop demo breakpoints.

#### Scenario: Viewport changes
- **WHEN** viewport width changes across phone, tablet, and desktop ranges
- **THEN** layout reflows without horizontal overflow and preserves action operability
