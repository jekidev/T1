from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Personal Framework")


@mcp.tool()
def system_status() -> dict[str, object]:
    """Return the local MCP service status."""
    return {
        "ok": True,
        "service": "Personal Framework MCP",
        "capabilities": ["memory", "github", "writing"],
    }


def run() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    run()
