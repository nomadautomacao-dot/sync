Pasta pública do Firebase Hosting — **vazia de propósito**.

Todo caminho é reescrito para o Cloud Run (`sync-app`), que é quem serve o app
inteiro, inclusive os estáticos do Next. Arquivo colocado aqui passa a ser
servido **no lugar** da reescrita, silenciosamente: um `index.html` esquecido
aqui derrubaria o Sync e mostraria a página esquecida no lugar dele.

O Firebase exige que a pasta exista, e o git não versiona pasta vazia — daí
este arquivo.
