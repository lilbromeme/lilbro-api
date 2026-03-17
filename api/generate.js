export default async function handler(req, res) {
  const { prompt, image } = req.body;

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "c221b2b8ef5279883c6d5c5e9b3c8b0f8e7c7c6a3d0c5c7f9b9e7d3a6c4e2f1",
      input: {
        prompt,
        image,
      },
    }),
  });

  const data = await response.json();
  res.status(200).json(data);
}
