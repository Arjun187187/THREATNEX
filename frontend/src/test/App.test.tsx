import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Shield } from 'lucide-react';
import { SeverityBadge, StatusBadge, IOCTypePill, PriorityBadge } from '../components/common/Badges';
import { MetricCard } from '../components/common/MetricCard';
import { EmptyState } from '../components/common/EmptyState';

describe('ThreatNex Frontend SOC Component Suite', () => {
  it('renders severity badges accurately with uppercase labels', () => {
    const { rerender } = render(<SeverityBadge severity="critical" />);
    expect(screen.getByText('critical')).toBeInTheDocument();

    rerender(<SeverityBadge severity="high" />);
    expect(screen.getByText('high')).toBeInTheDocument();

    rerender(<SeverityBadge severity="low" />);
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('renders status badges with correct labels', () => {
    const { rerender } = render(<StatusBadge status="open" />);
    expect(screen.getByText('OPEN')).toBeInTheDocument();

    rerender(<StatusBadge status="in_progress" />);
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();

    rerender(<StatusBadge status="resolved" />);
    expect(screen.getByText('RESOLVED')).toBeInTheDocument();
  });

  it('renders priority badges with uppercase tags', () => {
    render(<PriorityBadge priority="critical" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders IOC type pill with format label', () => {
    render(<IOCTypePill type="ipv4" />);
    expect(screen.getByText('ipv4')).toBeInTheDocument();
  });

  it('renders enterprise MetricCard with value and subtitle', () => {
    render(
      <MetricCard
        title="Active Incidents"
        value={42}
        subtitle="Cases under investigation"
        icon={Shield}
        badge="CRITICAL"
        badgeColor="crimson"
      />
    );
    expect(screen.getByText('Active Incidents')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Cases under investigation')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders EmptyState with action button', () => {
    render(
      <EmptyState
        title="No alerts available"
        description="Threat inventory is clear of unacknowledged events."
        action={{ label: 'Trigger Triage', onClick: () => {} }}
      />
    );
    expect(screen.getByText('No alerts available')).toBeInTheDocument();
    expect(screen.getByText('Threat inventory is clear of unacknowledged events.')).toBeInTheDocument();
    expect(screen.getByText('Trigger Triage')).toBeInTheDocument();
  });
});
