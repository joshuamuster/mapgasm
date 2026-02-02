//TIP With Search Everywhere, you can find any action, file, or symbol in your project. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/>, type in <b>terminal</b>, and press <shortcut actionId="EditorEnter"/>. Then run <shortcut raw="npm run dev"/> in the terminal and click the link in its output to open the app in the browser.
interface Opening {
  kind: string;
  span?: [number, number];
}

interface Room {
  id: string;
  name: string;
  image: string;
  openings?: {
    N?: Opening;
    E?: Opening;
    S?: Opening;
    W?: Opening;
  };
}

async function initGrid() {
  const response = await fetch('/rooms.json');
  const data = await response.json();
  const rooms: Room[] = data.rooms;

  const gridContainer = document.getElementById('grid-container');
  if (gridContainer) {
    gridContainer.innerHTML = '';
    const filteredRooms = rooms.filter((room) => room.id === 'cave-room-0');
    
    filteredRooms.forEach((room) => {
      // To keep the room centered at the bottom, we create a 3x2 grid area.
      // Row 1: [Empty] [North] [Empty]
      // Row 2: [West]  [Room]  [East]
      
      const gridPositions: { key: string; r: number; c: number; dir?: 'N' | 'E' | 'W' }[] = [
        { key: 'nw', r: 1, c: 1 },
        { key: 'n', r: 1, c: 2, dir: 'N' },
        { key: 'ne', r: 1, c: 3 },
        { key: 'w', r: 2, c: 1, dir: 'W' },
        { key: 'room', r: 2, c: 2 },
        { key: 'e', r: 2, c: 3, dir: 'E' },
      ];

      gridPositions.forEach((pos) => {
        const box = document.createElement('div');
        box.className = 'grid-item';
        box.style.gridRow = pos.r.toString();
        box.style.gridColumn = pos.c.toString();

        if (pos.key === 'room') {
          const img = document.createElement('img');
          img.src = room.image;
          img.alt = room.name;
          img.title = room.name;
          box.appendChild(img);
        } else if (pos.dir && room.openings?.[pos.dir]?.kind === 'door') {
          box.classList.add('potential-room');
        }
        gridContainer.appendChild(box);
      });
    });
  }
}

initGrid();

//TIP There's much more in WebStorm to help you be more productive. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/> and search for <b>Learn WebStorm</b> to open our learning hub with more things for you to try.
