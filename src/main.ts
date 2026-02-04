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
  allowRotation?: boolean;
  weight?: number;
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
  rotation: number;
}

let allRooms: Room[] = [];
let placedRooms: PlacedRoom[] = [];
let activeRoomCoord: { x: number; y: number } | null = null;

// Panning and Zooming state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let offsetX = 0;
let offsetY = 0;
let scale = 1;

// Touch state for pinching
let lastTouchDistance = 0;
let lastTouchMidX = 0;
let lastTouchMidY = 0;

// Grid boundaries for recentering
let currentRangeMinX: number | null = null;
let currentMaxY: number | null = null;

// Animation state
let animationFrameId: number | null = null;

function cancelAnimation() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const dirList: ("N" | "E" | "S" | "W")[] = ["N", "E", "S", "W"];

function getOpeningKind(
  room: Room,
  rotation: number,
  gridDir: "N" | "E" | "S" | "W"
): string {
  const gIndex = dirList.indexOf(gridDir);
  const oIndex = (gIndex - rotation + 4) % 4;
  const oDir = dirList[oIndex];
  return room.openings?.[oDir]?.kind || "none";
}

function isMatching(k1: string, k2: string): boolean {
  return k1 === k2;
}

function getConstraints(
  x: number,
  y: number
): { dir: "N" | "E" | "S" | "W"; kind: string }[] {
  const oppositeDirMap: Record<string, "N" | "E" | "S" | "W"> = {
    N: "S",
    E: "W",
    S: "N",
    W: "E",
  };

  const directions: { dir: "N" | "E" | "S" | "W"; dx: number; dy: number }[] = [
    { dir: "N", dx: 0, dy: 1 },
    { dir: "E", dx: 1, dy: 0 },
    { dir: "S", dx: 0, dy: -1 },
    { dir: "W", dx: -1, dy: 0 },
  ];

  return directions
    .map(({ dir, dx, dy }) => {
      const neighbor = placedRooms.find((r) => r.x === x + dx && r.y === y + dy);
      if (neighbor) {
        const neighborOpeningKind = getOpeningKind(
          neighbor.room,
          neighbor.rotation,
          oppositeDirMap[dir]
        );
        return { dir, kind: neighborOpeningKind };
      }
      return null;
    })
    .filter((c): c is { dir: "N" | "E" | "S" | "W"; kind: string } => c !== null);
}

async function initGrid() {
  const response = await fetch("/rooms.json");
  const data = await response.json();
  allRooms = data.rooms;

  const startRoom = allRooms.find((r) => r.id === "cave-room-0");
  if (startRoom) {
    placedRooms.push({ x: 0, y: 0, room: startRoom, rotation: 0 });
    activeRoomCoord = { x: 0, y: 0 };
  }

  renderGrid();
  recenter(undefined, undefined, true);
  setupEventListeners();
}

function setupEventListeners() {
  const app = document.getElementById('app');
  const gridContainer = document.getElementById('grid-container');
  const recenterLink = document.getElementById('recenter-link');
  const centerStartButton = document.getElementById('center-start-button');
  const centerActiveButton = document.getElementById('center-active-button');

  if (!app || !gridContainer) return;

  const onStart = (clientX: number, clientY: number) => {
    cancelAnimation();
    isDragging = true;
    dragStartX = clientX - offsetX;
    dragStartY = clientY - offsetY;
    gridContainer.style.cursor = 'grabbing';
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    offsetX = clientX - dragStartX;
    offsetY = clientY - dragStartY;
    updateTransform();
  };

  const onEnd = () => {
    isDragging = false;
    gridContainer.style.cursor = 'grab';
  };

  app.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onEnd);

  app.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isDragging = false;
      lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    } else if (e.touches.length === 1) {
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const factor = distance / lastTouchDistance;
      zoomAt(midX, midY, factor, true);

      lastTouchDistance = distance;
      lastTouchMidX = midX;
      lastTouchMidY = midY;
    } else if (e.touches.length === 1) {
      if (isDragging) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    }
  }, { passive: false });
  window.addEventListener('touchend', onEnd);

  app.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      cancelAnimation();
      if (e.ctrlKey) {
        // Pinch zoom on trackpad
        const factor = Math.exp(-e.deltaY * 0.01);
        zoomAt(e.clientX, e.clientY, factor);
      } else {
        offsetX -= e.deltaX;
        offsetY -= e.deltaY;
        updateTransform();
      }
    },
    { passive: false }
  );

  if (recenterLink) {
    recenterLink.addEventListener('click', (e) => {
      e.preventDefault();
      resetBoard();
    });
  }

  if (centerStartButton) {
    centerStartButton.addEventListener('click', (e) => {
      e.preventDefault();
      recenter(0, 0);
    });
  }

  if (centerActiveButton) {
    centerActiveButton.addEventListener('click', (e) => {
      e.preventDefault();
      recenter();
    });
  }
}

function zoomAt(clientX: number, clientY: number, factor: number, isPinch = false) {
  cancelAnimation();
  const newScale = Math.min(Math.max(scale * factor, 0.2), 5);
  const actualFactor = newScale / scale;

  if (isPinch) {
    offsetX = clientX - (lastTouchMidX - offsetX) * actualFactor;
    offsetY = clientY - (lastTouchMidY - offsetY) * actualFactor;
  } else {
    offsetX = clientX - (clientX - offsetX) * actualFactor;
    offsetY = clientY - (clientY - offsetY) * actualFactor;
  }

  scale = newScale;
  updateTransform();
}

function updateTransform() {
  const gridContainer = document.getElementById('grid-container');
  const app = document.getElementById('app');
  if (gridContainer && app) {
    gridContainer.style.transformOrigin = '0 0';
    gridContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    app.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    app.style.backgroundSize = `${200 * scale}px ${200 * scale}px`;
  }
}

function resetBoard() {
  cancelAnimation();

  const gridItems = document.querySelectorAll('.placed-room');
  let hasRoomsToRemove = false;

  gridItems.forEach((item) => {
    const htmlItem = item as HTMLElement;
    const x = parseInt(htmlItem.dataset.x || '0');
    const y = parseInt(htmlItem.dataset.y || '0');

    if (x !== 0 || y !== 0) {
      htmlItem.classList.add('fade-out');
      hasRoomsToRemove = true;
    }
  });

  const resetState = (immediate: boolean) => {
    placedRooms = placedRooms.filter((r) => r.x === 0 && r.y === 0);
    activeRoomCoord = { x: 0, y: 0 };
    renderGrid();
    recenter(0, 0, immediate);
  };

  if (hasRoomsToRemove) {
    // Start scrolling to center immediately, matching the fade duration (500ms)
    recenter(0, 0, false, 500);
    // Wait for the fade-out transition (0.5s in CSS)
    setTimeout(() => resetState(true), 500);
  } else {
    resetState(false);
  }
}

function recenter(
  x?: number,
  y?: number,
  immediate: boolean = false,
  duration: number = 1000
) {
  let targetCoordX = x;
  let targetCoordY = y;

  if (targetCoordX === undefined || targetCoordY === undefined) {
    if (!activeRoomCoord) return;
    targetCoordX = activeRoomCoord.x;
    targetCoordY = activeRoomCoord.y;
  }

  if (currentRangeMinX === null || currentMaxY === null) return;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Each cell is 200x200.
  // The cell at (x, y) is at grid-relative position:
  // left: (x - currentRangeMinX) * 200
  // top: (currentMaxY - y) * 200

  const targetX = ((targetCoordX - currentRangeMinX) * 200 + 100) * scale;
  const targetY = ((currentMaxY - targetCoordY) * 200 + 100) * scale;

  const desiredOffsetX = viewportWidth / 2 - targetX;
  const desiredOffsetY = viewportHeight / 2 - targetY;

  if (immediate) {
    cancelAnimation();
    offsetX = desiredOffsetX;
    offsetY = desiredOffsetY;
    updateTransform();
  } else {
    animateTo(desiredOffsetX, desiredOffsetY, duration);
  }
}

function animateTo(targetX: number, targetY: number, duration: number = 1000) {
  cancelAnimation();
  const startX = offsetX;
  const startY = offsetY;
  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeInOutCubic(progress);

    offsetX = startX + (targetX - startX) * ease;
    offsetY = startY + (targetY - startY) * ease;
    updateTransform();

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(step);
    } else {
      animationFrameId = null;
    }
  }
  animationFrameId = requestAnimationFrame(step);
}

function renderGrid() {
  const gridContainer = document.getElementById('grid-container');
  if (!gridContainer) return;

  gridContainer.innerHTML = '';
  gridContainer.style.cursor = 'grab';

  const potentialRooms = new Map<string, { x: number; y: number }>();
  const directions: { dir: 'N' | 'E' | 'S' | 'W'; dx: number; dy: number }[] = [
    { dir: 'N', dx: 0, dy: 1 },
    { dir: 'E', dx: 1, dy: 0 },
    { dir: 'S', dx: 0, dy: -1 },
    { dir: 'W', dx: -1, dy: 0 },
  ];

  placedRooms.forEach((placed) => {
    directions.forEach(({ dir, dx, dy }) => {
      const nx = placed.x + dx;
      const ny = placed.y + dy;
      const key = `${nx},${ny}`;

      const openingKind = getOpeningKind(placed.room, placed.rotation, dir);
      const isStartingRoomSouth =
        placed.x === 0 && placed.y === 0 && dir === "S";

      // Only add a potential room if the current side has an expandable opening
      // (not "none" and not the South side of the starting room)
      const isExpandable = openingKind !== "none";
      if (isExpandable && !isStartingRoomSouth) {
        if (!placedRooms.some((r) => r.x === nx && r.y === ny)) {
          potentialRooms.set(key, { x: nx, y: ny });
        }
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

  // Adjust offset to keep content stable when grid boundaries expand
  if (currentRangeMinX !== null && currentMaxY !== null) {
    const dx = (rangeMinX - currentRangeMinX) * 200 * scale;
    const dy = (maxY - currentMaxY) * 200 * scale;
    offsetX += dx;
    offsetY -= dy;
  }

  currentRangeMinX = rangeMinX;
  currentMaxY = maxY;

  for (let y = maxY; y >= minY; y--) {
    for (let x = rangeMinX; x <= rangeMaxX; x++) {
      const box = document.createElement('div');
      box.className = 'grid-item';
      box.dataset.x = x.toString();
      box.dataset.y = y.toString();
      box.style.gridRow = (maxY - y + 1).toString();
      box.style.gridColumn = (x - rangeMinX + 1).toString();

      const placed = placedRooms.find(r => r.x === x && r.y === y);
      if (placed) {
        box.classList.add('placed-room');
        if (activeRoomCoord && activeRoomCoord.x === x && activeRoomCoord.y === y) {
          box.classList.add('active-room');
        }
        box.addEventListener('click', () => {
          if (!(activeRoomCoord && activeRoomCoord.x === x && activeRoomCoord.y === y)) {
            activeRoomCoord = { x, y };
            renderGrid();
          }
        });
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
  updateTransform();
}

function handlePotentialClick(x: number, y: number) {
  // Find all existing neighbors to determine constraints
  const constraints = getConstraints(x, y);

  const candidates: { room: Room; rotation: number }[] = [];

  allRooms.forEach((candidate) => {
    // Skip rooms with "entrance" tag during generation
    if (candidate.tags?.includes("entrance")) {
      return;
    }

    // Check unique rooms rule
    if (placedRooms.some((pr) => pr.room.id === candidate.id)) {
      return;
    }

    const rotations = [0];

    rotations.forEach((rot) => {
      const matches = constraints.every((c) => {
        const candidateKind = getOpeningKind(candidate, rot, c.dir);
        return isMatching(candidateKind, c.kind);
      });

      if (matches) {
        candidates.push({ room: candidate, rotation: rot });
      }
    });
  });

  if (candidates.length > 0) {
    // Weighted random selection
    const totalWeight = candidates.reduce(
      (sum, c) => sum + (c.room.weight || 1),
      0
    );
    let random = Math.random() * totalWeight;
    let selected = candidates[0];

    for (const c of candidates) {
      const w = c.room.weight || 1;
      if (random < w) {
        selected = c;
        break;
      }
      random -= w;
    }

    placedRooms.push({ x, y, room: selected.room, rotation: selected.rotation });
    activeRoomCoord = { x, y };
    renderGrid();
  } else {
    console.warn(
      `No suitable room found at (${x}, ${y}) that matches all adjacent walls/doors.`
    );
    console.log("Constraints at this position:", constraints);
  }
}

initGrid();

//TIP There's much more in WebStorm to help you be more productive. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/> and search for <b>Learn WebStorm</b> to open our learning hub with more things for you to try.
