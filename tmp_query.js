const key = "AIzaSyBzrqixc4npBep-aES7_fKqeeEsHUR-BE0";
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.models.map(m => m.name), null, 2)))
  .catch(console.error);
