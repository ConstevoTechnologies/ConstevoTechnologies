/**
 * Azure FinOps Dashboard — Recommendations Engine
 * Generates prioritized optimization recommendations from resource issues.
 */

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function buildRecommendations() {
  const recs = [];

  AZURE_DATA.resources.forEach(r => {
    if (r.issues.length === 0) return;

    r.issues.forEach((issue, idx) => {
      const severity = getIssueSeverity(r, issue);
      const icon = getIssueIcon(issue);
      const category = getIssueCategory(issue);
      const saving = idx === 0 ? r.potentialSaving : 0;

      recs.push({
        id: `${r.id}-${idx}`,
        resource: r.name,
        resourceType: r.typeLabel,
        rg: r.rg,
        severity,
        title: buildTitle(r, issue),
        description: buildDescription(r, issue),
        saving,
        icon,
        category,
        tags: buildTags(r, issue),
        fixSteps: idx === 0 ? r.fixSteps : []
      });
    });
  });

  // Sort: critical first, then by saving desc
  recs.sort((a, b) => {
    if (SEVERITY_ORDER[a.severity] !== SEVERITY_ORDER[b.severity])
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return b.saving - a.saving;
  });

  return recs;
}

function getIssueSeverity(resource, issue) {
  if (resource.status === 'critical') {
    if (issue.toLowerCase().includes('orphan') || issue.toLowerCase().includes('not used')) return 'critical';
    return 'high';
  }
  if (issue.toLowerCase().includes('no reserved') || issue.toLowerCase().includes('not needed')) return 'high';
  return 'medium';
}

function getIssueIcon(issue) {
  const i = issue.toLowerCase();
  if (i.includes('oversized') || i.includes('downgrad') || i.includes('resize')) return 'resize';
  if (i.includes('orphan') || i.includes('unattached') || i.includes('unused')) return 'delete';
  if (i.includes('schedule') || i.includes('auto-shutdown') || i.includes('stop')) return 'schedule';
  if (i.includes('reserved') || i.includes('spot') || i.includes('serverless')) return 'savings';
  if (i.includes('tier') || i.includes('cold') || i.includes('archive')) return 'storage';
  if (i.includes('autoscal') || i.includes('scale')) return 'scale';
  return 'optimize';
}

function getIssueCategory(issue) {
  const i = issue.toLowerCase();
  if (i.includes('oversized') || i.includes('downgrad') || i.includes('resize')) return 'Right-sizing';
  if (i.includes('orphan') || i.includes('unattached')) return 'Orphaned Resources';
  if (i.includes('schedule') || i.includes('shutdown')) return 'Scheduling';
  if (i.includes('reserved') || i.includes('spot')) return 'Commitment Discount';
  if (i.includes('tier') || i.includes('serverless')) return 'Service Tier';
  if (i.includes('autoscal')) return 'Auto-scaling';
  return 'Configuration';
}

function buildTitle(resource, issue) {
  const i = issue.toLowerCase();
  if (i.includes('oversized')) return `Right-size ${resource.name} to match actual workload`;
  if (i.includes('orphan') || i.includes('unattached')) return `Delete orphaned ${resource.typeLabel.toLowerCase()} — zero utilization`;
  if (i.includes('auto-shutdown') || i.includes('not needed nights')) return `Configure auto-shutdown/stop schedule for ${resource.name}`;
  if (i.includes('reserved instance')) return `Purchase Reserved Instance for ${resource.name}`;
  if (i.includes('spot')) return `Use Spot node pools in ${resource.name}`;
  if (i.includes('serverless')) return `Migrate ${resource.name} to Serverless tier`;
  if (i.includes('cool') || i.includes('archive') || i.includes('hot tier')) return `Optimize storage tier for ${resource.name}`;
  if (i.includes('redundancy') || i.includes('grs')) return `Reduce storage redundancy for ${resource.name}`;
  if (i.includes('autoscal')) return `Enable auto-scaling on ${resource.name}`;
  return `Fix configuration issue on ${resource.name}: ${issue.split('—')[0].trim()}`;
}

function buildDescription(resource, issue) {
  const i = issue.toLowerCase();
  if (i.includes('oversized')) {
    return `${resource.name} (${resource.sku || resource.edition}) is provisioned well beyond actual workload. ` +
           `Current utilization is only ${resource.usage}%. Right-sizing to a smaller SKU will significantly reduce costs ` +
           `with no performance impact for the current workload.`;
  }
  if (i.includes('orphan') || i.includes('unattached')) {
    return `This ${resource.typeLabel.toLowerCase()} is not attached to any active resource and has had 0% utilization ` +
           `for over 45 days. Creating a snapshot and deleting it will eliminate $${resource.potentialSaving}/month in waste.`;
  }
  if (i.includes('auto-shutdown') || i.includes('24/7') || i.includes('not needed')) {
    return `${resource.name} is running 24/7 but is only needed during business hours. ` +
           `Implementing an automated stop/start schedule for nights and weekends can save up to 65% of the monthly cost.`;
  }
  if (i.includes('reserved instance')) {
    return `Committing to a 1-year Reserved Instance for ${resource.name} provides up to 40% savings ` +
           `compared to pay-as-you-go pricing, with no change to performance or availability.`;
  }
  if (i.includes('serverless')) {
    return `${resource.name} has only ${resource.usage}% utilization and runs 24/7. ` +
           `Switching to the Serverless tier enables auto-pause when idle, charging only for compute seconds used.`;
  }
  return `${issue} — Review and apply the recommended fix to optimize cost without impacting functionality.`;
}

function buildTags(resource, issue) {
  const tags = [resource.typeLabel, resource.region || 'Unknown'];
  const i = issue.toLowerCase();
  if (i.includes('cpu') || i.includes('memory') || i.includes('oversized')) tags.push('Right-size');
  if (i.includes('cost') || i.includes('waste')) tags.push('Cost Waste');
  if (i.includes('reserved') || i.includes('spot') || i.includes('commitment')) tags.push('Commitment');
  if (i.includes('schedule') || i.includes('shutdown') || i.includes('stop')) tags.push('Scheduling');
  return tags.slice(0, 4);
}

const ICON_SVGS = {
  resize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
  schedule: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  savings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M21.18 8.02c-1-2.3-2.85-4.17-5.18-5.18"/></svg>`,
  storage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  optimize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`
};
