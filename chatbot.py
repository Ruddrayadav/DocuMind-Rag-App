from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, BaseMessage, SystemMessage, AIMessage
from typing import TypedDict, Annotated
from langchain_ollama import ChatOllama
from langgraph.checkpoint.sqlite import SqliteSaver
from ragpipeline import retrieve_context, deduplicate_sources
import sqlite3

from dotenv import load_dotenv
load_dotenv()


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


LLM = ChatOllama(
    model="gemma3:4b"
)


SYSTEM_PROMPT = """You are an AI document assistant.

Answer questions only using the supplied document context.

Rules:
- Do not make up information.
- If the answer cannot be found in the supplied context, say:
  "I couldn't find this information in the provided documents."
- Do not invent facts.
- Do not invent sources.
- Do not invent filenames or page numbers.
- Cite the documents you use by their ID in brackets like [1] or [2].
- Source attribution is handled by the application.
- Keep answers clear and concise.
"""


def chat_node(state: ChatState):

    messages = state["messages"]

    user_question = messages[-1].content

    context, sources, _meta = retrieve_context(user_question)

    print("\nDEBUG SOURCES:")
    print(sources)
    print("====================\n")

    rag_prompt = f"""
    {SYSTEM_PROMPT}

    Context:
    {context}

    User Question:
    {user_question}

    Answer the question using only the context above.
    """

    response = LLM.invoke(
        [
            SystemMessage(content=rag_prompt),
            *messages
        ]
    )

    source_lines = []
    for source in deduplicate_sources(sources):
        filename = source.get("source", "Unknown")
        page = source.get("page")

        if page is not None:
            source_text = f"{filename} - Page {page}"
        else:
            source_text = filename

        source_lines.append(source_text)

    if source_lines:
        sources_text = "\n".join(f"- {source}" for source in source_lines)
        final_answer = f"{response.content}\n\nSources:\n{sources_text}"
    else:
        final_answer = response.content

    return {
        "messages": [
            AIMessage(content=final_answer)
        ]
    }


conn = sqlite3.connect("chatbot.db", check_same_thread=False)

checkpointer = SqliteSaver(conn=conn)


graph = StateGraph(ChatState)

graph.add_node("chat_node", chat_node)

graph.add_edge(START, "chat_node")
graph.add_edge("chat_node", END)


chatbot = graph.compile(checkpointer=checkpointer)


def chat():

    print("\n==============================")
    print("      AI CHATBOT")
    print("==============================")
    print("Type 'exit' to quit.")
    print()

    thread_id = "user_1"

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    while True:

        user_input = input("You: ")

        if user_input.lower() == "exit":
            print("Goodbye!")
            break

        result = chatbot.invoke(
            {
                "messages": [
                    HumanMessage(content=user_input)
                ]
            },
            config=config
        )

        response = result["messages"][-1]

        print("AI:", response.content)
        print()


if __name__ == "__main__":
    chat()
