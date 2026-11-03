export const missions = [
  {
    id: 'vesper',
    name: 'Vesper',
    field: 'Autonomous systems',
    line: 'Intelligence needs somewhere to live.',
    description: 'One agent, four deployment architectures. A measured expedition through hosted, self-hosted and hybrid AI systems.',
    repo: 'agent-hosting-lab',
    kind: 0,
    radius: 11,
    position: [-180, 15, 0],
    note: 'Volcanic crust / active relay',
  },
  {
    id: 'pelagic',
    name: 'Pelagic',
    field: 'Private infrastructure',
    line: 'Not every connection should be visible.',
    description: 'A practical atlas of Microsoft Fabric private networking: endpoints, data sources and routes back to on-premises.',
    repo: 'fabric-private-networking-cookbook',
    kind: 1,
    radius: 13,
    position: [170, -30, -240],
    note: 'Ice giant / restricted approach',
  },
  {
    id: 'parallax',
    name: 'Parallax',
    field: 'Quantum computing',
    line: 'The other route is not always classical.',
    description: 'Ten hands-on levels of quantum computing in Qiskit and Q#, from the first circuit to quantum error correction.',
    repo: 'Introduction-to-Quantum-Computing',
    kind: 2,
    radius: 10,
    position: [300, 25, -510],
    note: 'Interference world / paired moons',
  },
  {
    id: 'ferrum',
    name: 'Ferrum',
    field: 'Software supply chains',
    line: 'Arrival is not proof of provenance.',
    description: 'A working VNF/CNF lifecycle with GitOps, AKS, signed artifacts, policy enforcement and deployable infrastructure.',
    repo: 'telco-devsecops-demo',
    kind: 3,
    radius: 10.5,
    position: [-250, 10, -650],
    note: 'Iron surface / verified cargo',
  },
  {
    id: 'halation',
    name: 'Halation',
    field: 'Creative engineering',
    line: 'A different frame changes everything.',
    description: 'A photo collage studio for web, iOS and Android, built around one shared TypeScript layout engine.',
    repo: 'collage-studio',
    kind: 4,
    radius: 12,
    position: [80, 45, -940],
    note: 'Desert terraces / scattered light',
  },
  {
    id: 'aphelion',
    name: 'Aphelion',
    field: 'Developer experience',
    line: 'Better instruments. Further horizons.',
    description: 'A hands-on GitHub Copilot workshop for improving the entire development lifecycle, not just writing the next line.',
    repo: 'ghcopilot-optimization-workshop',
    kind: 5,
    radius: 14,
    position: [-180, -10, -1210],
    note: 'Banded atmosphere / outer station',
  },
];

export const repositoryUrl = mission => `https://github.com/chapi-dev/${mission.repo}`;

export function missionFromLocation(location) {
  const id = new URL(location).searchParams.get('destination');
  const index = missions.findIndex(mission => mission.id === id);
  return index < 0 ? 0 : index;
}
