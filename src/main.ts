//TIP With Search Everywhere, you can find any action, file, or symbol in your project. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/>, type in <b>terminal</b>, and press <shortcut actionId="EditorEnter"/>. Then run <shortcut raw="npm run dev"/> in the terminal and click the link in its output to open the app in the browser.
interface Room {
  id: string;
  name: string;
  image: string;
}

async function initGrid() {
  const response = await fetch('/rooms.json');
  const data = await response.json();
  const rooms: Room[] = data.rooms;

  const gridContainer = document.getElementById('grid-container');
  if (gridContainer) {
    const filteredRooms = rooms.filter(room => room.id === 'cave-room-0');
    filteredRooms.forEach((room) => {
      const item = document.createElement('div');
      item.className = 'grid-item';
      
      const img = document.createElement('img');
      img.src = room.image;
      img.alt = room.name;
      img.title = room.name;
      
      item.appendChild(img);
      gridContainer.appendChild(item);
    });
  }
}

initGrid();

//TIP There's much more in WebStorm to help you be more productive. Press <shortcut actionId="Shift"/> <shortcut actionId="Shift"/> and search for <b>Learn WebStorm</b> to open our learning hub with more things for you to try.
