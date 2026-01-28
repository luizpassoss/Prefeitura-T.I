const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;


const importRoutes = require('./routes/import/importRoutes');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Front
const publicPath = path.join(__dirname, '..', 'front', 'public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'global.html'));
});

// ROTAS API
app.use('/api/links', require('./routes/linksRoutes'));
app.use('/api/maquinas', require('./routes/maquinasRoutes'));
app.use('/api/modulos', require('./routes/modulos/modulosRoutes'));
app.use('/api/modulos', require('./routes/modulos/camposRoutes'));
app.use('/api/modulos', require('./routes/modulos/registrosRoutes'));

app.use('/api', require('./routes/manualCustomRoutes'));
app.use('/api', require('./routes/systemConfigRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));

app.use('/api/import', importRoutes);


// SERVIDOR (SEMPRE POR ÚLTIMO)
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
