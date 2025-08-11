from sqlmodel import Session, create_engine

DATABASE_URL = "sqlite:///./foodlog.db"
engine = create_engine(DATABASE_URL, echo=False)

def get_engine():
    return engine

def get_session():
    with Session(get_engine()) as session:
        yield session
