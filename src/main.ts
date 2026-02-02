//TIP With Search Everywhere, you can find any action, file, or symbol in your project. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/>, type in <b>terminal</b>, and press <shortcut actionId="EditorEnter"/>. Then run <shortcut raw="npm run dev"/> in the terminal and click the link in its output to open the app in the browser.
interface Opening {
  kind: string;
  span?: [number, number];
}

interface Room {
  id: string;
  name: string;
  image: string;
  tags?: string[];
  openings?: {
    N?: Opening;
    E?: Opening;
    S?: Opening;
    W?: Opening;
  };
}

interface PlacedRoom {
  x: number;
  y: number;
  room: Room;
}

let allRooms: Room[] = [];
let placedRooms: PlacedRoom[] = [];
let activeRoomCoord: { x: number; y: number } | null = null;

async function initGrid() {
  const response = await fetch('/rooms.json');
  const data = await response.json();
  allRooms = data.rooms;
  
  const startRoom = allRooms.find(r => r.id === 'cave-room-0');
  if (startRoom) {
    placedRooms.push({ x: 0, y: 0, room: startRoom });
    activeRoomCoord = { x: 0, y: 0 };
  }
  
  renderGrid();
}

function renderGrid() {
  const gridContainer = document.getElementById('grid-container');
  if (!gridContainer) return;

  gridContainer.innerHTML = '';

  const potentialRooms = new Map<string, { x: number; y: number; fromDir: 'N' | 'E' | 'S' | 'W' }>();
  
  placedRooms.forEach(placed => {
    const directions: { dir: 'N' | 'E' | 'S' | 'W'; dx: number; dy: number }[] = [
      { dir: 'N', dx: 0, dy: 1 },
      { dir: 'E', dx: 1, dy: 0 },
      { dir: 'S', dx: 0, dy: -1 },
      { dir: 'W', dx: -1, dy: 0 },
    ];

    directions.forEach(({ dir, dx, dy }) => {
      // Keep cave-room-0 at the "very bottom" by ignoring its South side for potential growth at the start.
      if (placed.x === 0 && placed.y === 0 && dir === 'S') return;

      const nx = placed.x + dx;
      const ny = placed.y + dy;
      const key = `${nx},${ny}`;
      if (!placedRooms.some((r) => r.x === nx && r.y === ny)) {
        potentialRooms.set(key, { x: nx, y: ny, fromDir: dir });
      }
    });
  });

  const allCoords = [
    ...placedRooms.map(r => ({ x: r.x, y: r.y })),
    ...Array.from(potentialRooms.values()).map(p => ({ x: p.x, y: p.y }))
  ];

  if (allCoords.length === 0) return;

  const minX = Math.min(...allCoords.map(c => c.x));
  const maxX = Math.max(...allCoords.map(c => c.x));
  const minY = Math.min(...allCoords.map(c => c.y));
  const maxY = Math.max(...allCoords.map(c => c.y));

  // Maintain symmetry to keep (0,0) centered
  const absMaxX = Math.max(Math.abs(minX), Math.abs(maxX));
  const rangeMinX = -absMaxX;
  const rangeMaxX = absMaxX;

  for (let y = maxY; y >= minY; y--) {
    for (let x = rangeMinX; x <= rangeMaxX; x++) {
      const box = document.createElement('div');
      box.className = 'grid-item';
      box.style.gridRow = (maxY - y + 1).toString();
      box.style.gridColumn = (x - rangeMinX + 1).toString();

      const placed = placedRooms.find(r => r.x === x && r.y === y);
      if (placed) {
        if (activeRoomCoord && activeRoomCoord.x === x && activeRoomCoord.y === y) {
          box.classList.add('active-room');
        }
        const img = document.createElement('img');
        img.src = placed.room.image;
        img.alt = placed.room.name;
        img.title = placed.room.name;
        box.appendChild(img);
      } else {
        const potential = potentialRooms.get(`${x},${y}`);
        if (potential) {
          box.classList.add('potential-room');
          box.addEventListener('click', () => {
            handlePotentialClick(potential.x, potential.y);
          });
        }
      }
      gridContainer.appendChild(box);
    }
  }
}

function handlePotentialClick(x: number, y: number) {
  const oppositeDirMap: Record<string, 'N' | 'E' | 'S' | 'W'> = {
    N: 'S',
    E: 'W',
    S: 'N',
    W: 'E',
  };

  const directions: { dir: 'N' | 'E' | 'S' | 'W'; dx: number; dy: number }[] = [
    { dir: 'N', dx: 0, dy: 1 },
    { dir: 'E', dx: 1, dy: 0 },
    { dir: 'S', dx: 0, dy: -1 },
    { dir: 'W', dx: -1, dy: 0 },
  ];

  // Find all existing neighbors to determine constraints
  const constraints = directions
    .map(({ dir, dx, dy }) => {
      const neighbor = placedRooms.find((r) => r.x === x + dx && r.y === y + dy);
      if (neighbor) {
        return { dir, kind: neighbor.room.openings?.[oppositeDirMap[dir]]?.kind || 'none' };
      }
      return null;
    })
    .filter((c): c is { dir: 'N' | 'E' | 'S' | 'W'; kind: string } => c !== null);

  const candidates = allRooms.filter((candidate) => {
    // Skip rooms with "entrance" tag during generation
    if (candidate.tags?.includes('entrance')) {
      return false;
    }

    return constraints.every((c) => {
      const candidateKind = candidate.openings?.[c.dir]?.kind || 'none';
      return candidateKind === c.kind;
    });
  });

  if (candidates.length > 0) {
    const nextRoom = candidates[Math.floor(Math.random() * candidates.length)];
    placedRooms.push({ x, y, room: nextRoom });
    activeRoomCoord = { x, y };
    renderGrid();
  } else {
    console.warn(`No suitable room found at (${x}, ${y}) that matches all adjacent walls/doors.`);
  }
}

initGrid();

//TIP There's much more in WebStorm to help you be more productive. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/> and search for <b>Learn WebStorm</b> to open our learning hub with more things for you to try.
