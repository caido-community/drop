export const fetchUserName = async () => {
  try {
    const auth = JSON.parse(
      localStorage.getItem("CAIDO_AUTHENTICATION") || "{}",
    );
    const accessToken = auth.accessToken;

    if (!accessToken) {
      throw new Error("No access token found");
    }

    const query = `query Viewer {
      viewer {
        ...on CloudUser {
          profile {
            identity {
              name
            }
          }
        }
      }
    }`;

    const response = await fetch("/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        operationName: "Viewer",
      }),
    });

    const data = await response.json();
    if (!data?.data?.viewer?.profile?.identity?.name) {
      // Try legacy endpoint
      const legacyQuery = `query Viewer {
        viewer {
          profile {
            identity {
              name
            }
          }
        }
      }`;

      const legacyResponse = await fetch("/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: legacyQuery,
          operationName: "Viewer",
        }),
      });

      const legacyData = await legacyResponse.json();
      return legacyData?.data?.viewer?.profile?.identity?.name || "Caido User";
    }

    return data?.data?.viewer?.profile?.identity?.name;
  } catch (err) {
    console.error("Failed to fetch user name:", err);
    return "Caido User";
  }
};
